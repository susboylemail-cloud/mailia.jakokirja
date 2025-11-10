import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { notifySyncComplete } from '../services/websocket';
import logger from '../config/logger';

const router = Router();

// Process sync queue from offline client
router.post('/queue',
    authenticate,
    body('items').isArray(),
    async (req: AuthRequest, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { items } = req.body;
            const userId = req.user!.userId;
            const results = [];

            for (const item of items) {
                try {
                    // Insert into sync queue
                    const result = await query(
                        `INSERT INTO sync_queue 
                        (user_id, entity_type, entity_id, action, data, client_timestamp)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        RETURNING *`,
                        [
                            userId,
                            item.entity_type,
                            item.entity_id,
                            item.action,
                            JSON.stringify(item.data),
                            item.client_timestamp
                        ]
                    );

                    // Process the sync item immediately
                    await processSyncItem(result.rows[0]);

                    results.push({
                        clientId: item.clientId,
                        status: 'synced',
                        serverId: result.rows[0].id
                    });
                } catch (error) {
                    logger.error('Sync item error:', error);
                    results.push({
                        clientId: item.clientId,
                        status: 'failed',
                        error: (error as Error).message
                    });
                }
            }

            notifySyncComplete(userId, { results });
            res.json({ results });
        } catch (error) {
            logger.error('Sync queue error:', error);
            res.status(500).json({ error: 'Failed to process sync queue' });
        }
    }
);

// Get pending sync items for user
router.get('/pending', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const result = await query(
            `SELECT * FROM sync_queue 
            WHERE user_id = $1 AND sync_status = 'pending'
            ORDER BY client_timestamp ASC`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Get pending sync error:', error);
        res.status(500).json({ error: 'Failed to fetch pending sync items' });
    }
});

// Process a sync item
async function processSyncItem(item: any) {
    try {
        const { entity_type, entity_id, action, data } = item;

        switch (entity_type) {
            case 'delivery':
                if (action === 'update' || action === 'create') {
                    await query(
                        `INSERT INTO deliveries (route_id, subscriber_id, is_delivered, delivered_at, notes, sync_status)
                        VALUES ($1, $2, $3, $4, $5, 'synced')
                        ON CONFLICT (route_id, subscriber_id)
                        DO UPDATE SET 
                            is_delivered = $3,
                            delivered_at = $4,
                            notes = $5,
                            sync_status = 'synced',
                            updated_at = NOW()`,
                        [
                            data.routeId,
                            data.subscriberId,
                            data.isDelivered,
                            data.deliveredAt,
                            data.notes
                        ]
                    );
                }
                break;

            case 'route':
                if (action === 'update') {
                    await query(
                        `UPDATE routes 
                        SET status = $2, start_time = $3, end_time = $4, notes = $5, updated_at = NOW()
                        WHERE id = $1`,
                        [entity_id, data.status, data.startTime, data.endTime, data.notes]
                    );
                }
                break;

            case 'working_time':
                if (action === 'update' || action === 'create') {
                    await query(
                        `INSERT INTO working_times (user_id, work_date, start_time, end_time, break_duration, notes)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (user_id, work_date)
                        DO UPDATE SET 
                            start_time = $3,
                            end_time = $4,
                            break_duration = $5,
                            notes = $6,
                            updated_at = NOW()`,
                        [
                            item.user_id,
                            data.workDate,
                            data.startTime,
                            data.endTime,
                            data.breakDuration,
                            data.notes
                        ]
                    );
                }
                break;
        }

        // Mark as synced
        await query(
            `UPDATE sync_queue 
            SET sync_status = 'synced', synced_at = NOW()
            WHERE id = $1`,
            [item.id]
        );
    } catch (error) {
        logger.error('Process sync item error:', error);
        
        // Mark as failed
        await query(
            `UPDATE sync_queue 
            SET sync_status = 'failed', error_message = $2
            WHERE id = $1`,
            [item.id, (error as Error).message]
        );

        throw error;
    }
}

export default router;
