import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { broadcastRouteUpdate } from '../services/websocket';
import logger from '../config/logger';

const router = Router();

// Get all routes for today (admin/manager only) - for circuit tracker
router.get('/today', authenticate, async (req: AuthRequest, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const queryText = `
            SELECT r.*, c.circuit_name, c.circuit_id, u.username,
            (
                SELECT COUNT(DISTINCT s.id)
                FROM subscribers s
                WHERE s.circuit_id = r.circuit_id 
                AND s.is_active = true
                AND EXISTS (
                    SELECT 1 FROM subscriber_products sp
                    WHERE sp.subscriber_id = s.id 
                    AND sp.is_active = true
                    AND sp.product_code != 'STF'
                )
            ) as total_deliveries,
            (SELECT COUNT(*) FROM deliveries WHERE route_id = r.id AND is_delivered = true) as completed_deliveries
            FROM routes r
            JOIN circuits c ON r.circuit_id = c.id
            JOIN users u ON r.user_id = u.id
            WHERE r.route_date = $1
            ORDER BY c.circuit_id, r.created_at DESC
        `;

        const result = await query(queryText, [today]);
        res.json(result.rows);
    } catch (error) {
        logger.error('Get today routes error:', error);
        res.status(500).json({ error: 'Failed to fetch routes' });
    }
});

// Get user's routes
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const { date, status } = req.query;

        let queryText = `
            SELECT r.*, c.circuit_name, c.circuit_id,
            (
                SELECT COUNT(DISTINCT s.id)
                FROM subscribers s
                WHERE s.circuit_id = r.circuit_id 
                AND s.is_active = true
                AND EXISTS (
                    SELECT 1 FROM subscriber_products sp
                    WHERE sp.subscriber_id = s.id 
                    AND sp.is_active = true
                    AND sp.product_code != 'STF'
                )
            ) as total_deliveries,
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

// Reset or complete route status (admin only)
router.post('/:routeId/reset', authenticate, async (req: AuthRequest, res) => {
    try {
        const { routeId } = req.params;
        const { newStatus } = req.body; // 'not-started' or 'completed'
        const userRole = req.user!.role;

        // Only admins and managers can reset routes
        if (userRole !== 'admin' && userRole !== 'manager') {
            return res.status(403).json({ error: 'Unauthorized: Admin or manager access required' });
        }

        // Validate newStatus
        if (newStatus !== 'not-started' && newStatus !== 'completed') {
            return res.status(400).json({ error: 'Invalid status. Must be "not-started" or "completed"' });
        }

        // Build update query based on status
        const finalQuery = newStatus === 'not-started' 
            ? `UPDATE routes 
               SET status = 'not-started', start_time = NULL, end_time = NULL, updated_at = NOW()
               WHERE id = $1
               RETURNING *`
            : `UPDATE routes 
               SET status = 'completed', end_time = NOW(), updated_at = NOW()
               WHERE id = $1
               RETURNING *`;

        const result = await query(finalQuery, [routeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Route not found' });
        }

        // Get circuit_id string for the route
        const circuitResult = await query(
            'SELECT circuit_id FROM circuits WHERE id = $1',
            [result.rows[0].circuit_id]
        );

        const circuitId = circuitResult.rows[0]?.circuit_id;
        logger.info(`Route ${routeId} has circuit_id: ${circuitId}`);

        broadcastRouteUpdate(parseInt(routeId), {
            action: newStatus === 'not-started' ? 'reset' : 'complete',
            route: result.rows[0],
            circuitId,
            status: newStatus,
            startTime: result.rows[0].start_time,
            endTime: result.rows[0].end_time
        });

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Reset route error:', error);
        res.status(500).json({ error: 'Failed to reset route' });
    }
});

export default router;
