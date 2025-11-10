import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

// Get subscription changes
router.get('/changes', 
    authenticate, 
    authorize('admin', 'manager'),
    async (req, res) => {
        try {
            const { processed, startDate, endDate } = req.query;

            let queryText = `
                SELECT sc.*, c.circuit_id, c.circuit_name
                FROM subscription_changes sc
                LEFT JOIN circuits c ON sc.circuit_id = c.id
                WHERE 1=1
            `;
            const params: any[] = [];

            if (processed !== undefined) {
                params.push(processed === 'true');
                queryText += ` AND sc.processed = $${params.length}`;
            }

            if (startDate) {
                params.push(startDate);
                queryText += ` AND sc.created_at >= $${params.length}`;
            }

            if (endDate) {
                params.push(endDate);
                queryText += ` AND sc.created_at <= $${params.length}`;
            }

            queryText += ' ORDER BY sc.created_at DESC LIMIT 100';

            const result = await query(queryText, params);
            res.json(result.rows);
        } catch (error) {
            logger.error('Get subscription changes error:', error);
            res.status(500).json({ error: 'Failed to fetch subscription changes' });
        }
    }
);

// Mark subscription change as processed
router.post('/changes/:id/process',
    authenticate,
    authorize('admin', 'manager'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await query(
                `UPDATE subscription_changes 
                SET processed = true, processed_at = NOW()
                WHERE id = $1
                RETURNING *`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Subscription change not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            logger.error('Process subscription change error:', error);
            res.status(500).json({ error: 'Failed to process subscription change' });
        }
    }
);

export default router;
