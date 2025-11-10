import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { io } from '../services/websocket';
import logger from '../config/logger';

const router = Router();

// Update delivery status
router.post('/update',
    authenticate,
    body('routeId').isInt(),
    body('subscriberId').isInt(),
    body('isDelivered').isBoolean(),
    async (req: AuthRequest, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { routeId, subscriberId, isDelivered, notes } = req.body;

            const result = await query(
                `INSERT INTO deliveries (route_id, subscriber_id, is_delivered, delivered_at, notes, sync_status)
                VALUES ($1, $2, $3, $4, $5, 'synced')
                ON CONFLICT (route_id, subscriber_id)
                DO UPDATE SET 
                    is_delivered = $3, 
                    delivered_at = $4,
                    notes = $5,
                    sync_status = 'synced',
                    updated_at = NOW()
                RETURNING *`,
                [routeId, subscriberId, isDelivered, isDelivered ? new Date() : null, notes]
            );

            // Broadcast to route participants
            const deliveryUpdate = {
                routeId,
                subscriberId,
                isDelivered,
                delivery: result.rows[0],
                updatedBy: req.user!.username
            };
            
            io?.to(`route:${routeId}`).emit('delivery:updated', deliveryUpdate);
            logger.info(`Broadcasted delivery:updated to route:${routeId}`, deliveryUpdate);

            res.json(result.rows[0]);
        } catch (error) {
            logger.error('Update delivery error:', error);
            res.status(500).json({ error: 'Failed to update delivery' });
        }
    }
);

// Get deliveries for a route
router.get('/route/:routeId', authenticate, async (req, res) => {
    try {
        const { routeId } = req.params;

        const result = await query(
            `SELECT d.*, s.address, s.name, s.building_address
            FROM deliveries d
            JOIN subscribers s ON d.subscriber_id = s.id
            WHERE d.route_id = $1
            ORDER BY s.order_index, s.address`,
            [routeId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Get deliveries error:', error);
        res.status(500).json({ error: 'Failed to fetch deliveries' });
    }
});

export default router;
