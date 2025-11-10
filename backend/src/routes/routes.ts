import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { broadcastRouteUpdate } from '../services/websocket';
import logger from '../config/logger';

const router = Router();

// Get user's routes
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const { date, status } = req.query;

        let queryText = `
            SELECT r.*, c.circuit_name, c.circuit_id,
            (SELECT COUNT(*) FROM deliveries WHERE route_id = r.id) as total_deliveries,
            (SELECT COUNT(*) FROM deliveries WHERE route_id = r.id AND is_delivered = true) as completed_deliveries
            FROM routes r
            JOIN circuits c ON r.circuit_id = c.id
            WHERE r.user_id = $1
        `;
        const params: any[] = [userId];

        if (date) {
            params.push(date);
            queryText += ` AND r.route_date = $${params.length}`;
        }

        if (status) {
            params.push(status);
            queryText += ` AND r.status = $${params.length}`;
        }

        queryText += ' ORDER BY r.route_date DESC, r.created_at DESC';

        const result = await query(queryText, params);
        res.json(result.rows);
    } catch (error) {
        logger.error('Get routes error:', error);
        res.status(500).json({ error: 'Failed to fetch routes' });
    }
});

// Start a route
router.post('/start',
    authenticate,
    body('circuitId').notEmpty(),
    body('routeDate').isDate(),
    async (req: AuthRequest, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { circuitId, routeDate } = req.body;
            const userId = req.user!.userId;

            // Get circuit database ID
            const circuit = await query(
                'SELECT id FROM circuits WHERE circuit_id = $1',
                [circuitId]
            );

            if (circuit.rows.length === 0) {
                return res.status(404).json({ error: 'Circuit not found' });
            }

            // Create or update route
            const result = await query(
                `INSERT INTO routes (user_id, circuit_id, route_date, start_time, status)
                VALUES ($1, $2, $3, NOW(), 'in-progress')
                ON CONFLICT (user_id, circuit_id, route_date)
                DO UPDATE SET start_time = NOW(), status = 'in-progress', updated_at = NOW()
                RETURNING *`,
                [userId, circuit.rows[0].id, routeDate]
            );

            broadcastRouteUpdate(result.rows[0].id, {
                action: 'started',
                route: result.rows[0]
            });

            res.json(result.rows[0]);
        } catch (error) {
            logger.error('Start route error:', error);
            res.status(500).json({ error: 'Failed to start route' });
        }
    }
);

// Complete a route
router.post('/:routeId/complete', authenticate, async (req: AuthRequest, res) => {
    try {
        const { routeId } = req.params;
        const userId = req.user!.userId;

        const result = await query(
            `UPDATE routes 
            SET end_time = NOW(), status = 'completed', updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING *`,
            [routeId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Route not found' });
        }

        broadcastRouteUpdate(parseInt(routeId), {
            action: 'completed',
            route: result.rows[0]
        });

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Complete route error:', error);
        res.status(500).json({ error: 'Failed to complete route' });
    }
});

export default router;
