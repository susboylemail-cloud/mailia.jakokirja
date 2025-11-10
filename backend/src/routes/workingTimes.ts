import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

// Record working time start
router.post('/start',
    authenticate,
    body('workDate').isDate(),
    async (req: AuthRequest, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { workDate } = req.body;
            const userId = req.user!.userId;

            const result = await query(
                `INSERT INTO working_times (user_id, work_date, start_time)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id, work_date) 
                DO UPDATE SET start_time = NOW(), updated_at = NOW()
                RETURNING *`,
                [userId, workDate]
            );

            res.json(result.rows[0]);
        } catch (error) {
            logger.error('Start working time error:', error);
            res.status(500).json({ error: 'Failed to record start time' });
        }
    }
);

// Record working time end
router.post('/end',
    authenticate,
    body('workDate').isDate(),
    async (req: AuthRequest, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { workDate, breakDuration, notes } = req.body;
            const userId = req.user!.userId;

            const result = await query(
                `UPDATE working_times 
                SET end_time = NOW(),
                    break_duration = $3,
                    total_hours = EXTRACT(EPOCH FROM (NOW() - start_time)) / 3600 - COALESCE($3, 0) / 60.0,
                    notes = $4,
                    updated_at = NOW()
                WHERE user_id = $1 AND work_date = $2
                RETURNING *`,
                [userId, workDate, breakDuration || 0, notes]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Working time not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            logger.error('End working time error:', error);
            res.status(500).json({ error: 'Failed to record end time' });
        }
    }
);

// Get working times for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const { startDate, endDate } = req.query;

        let queryText = 'SELECT * FROM working_times WHERE user_id = $1';
        const params: any[] = [userId];

        if (startDate) {
            params.push(startDate);
            queryText += ` AND work_date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            queryText += ` AND work_date <= $${params.length}`;
        }

        queryText += ' ORDER BY work_date DESC';

        const result = await query(queryText, params);
        res.json(result.rows);
    } catch (error) {
        logger.error('Get working times error:', error);
        res.status(500).json({ error: 'Failed to fetch working times' });
    }
});

// Get all users' working times (admin/manager only)
router.get('/all', 
    authenticate, 
    authorize('admin', 'manager'),
    async (req, res) => {
        try {
            const { startDate, endDate } = req.query;

            let queryText = `
                SELECT wt.*, u.username, u.full_name
                FROM working_times wt
                JOIN users u ON wt.user_id = u.id
                WHERE 1=1
            `;
            const params: any[] = [];

            if (startDate) {
                params.push(startDate);
                queryText += ` AND work_date >= $${params.length}`;
            }

            if (endDate) {
                params.push(endDate);
                queryText += ` AND work_date <= $${params.length}`;
            }

            queryText += ' ORDER BY work_date DESC, u.username';

            const result = await query(queryText, params);
            res.json(result.rows);
        } catch (error) {
            logger.error('Get all working times error:', error);
            res.status(500).json({ error: 'Failed to fetch working times' });
        }
    }
);

export default router;
