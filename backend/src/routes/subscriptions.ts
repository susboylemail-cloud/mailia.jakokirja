import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

// Dynamic import of io to avoid circular dependencies
let io: any = null;
const getIO = async () => {
    if (!io) {
        const { io: socketIO } = await import('../server');
        io = socketIO;
    }
    return io;
};

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

// Manually add or update subscriber (admin and manager)
router.post('/subscriber',
    authenticate,
    authorize('admin', 'manager'),
    async (req, res) => {
        try {
            const { circuitId, street, number, building, apartment, name, products, orderIndex } = req.body;

            // Validate required fields
            if (!circuitId || !street || !products || products.length === 0) {
                return res.status(400).json({ 
                    error: 'Circuit ID, street, and at least one product are required' 
                });
            }

            // Get circuit internal ID
            const circuitResult = await query(
                'SELECT id FROM circuits WHERE circuit_id = $1',
                [circuitId]
            );

            if (circuitResult.rows.length === 0) {
                return res.status(404).json({ error: 'Circuit not found' });
            }

            const circuitDbId = circuitResult.rows[0].id;

            // Build address
            const address = `${street}${number ? ' ' + number : ''}${building ? ' ' + building : ''}${apartment ? ' ' + apartment : ''}`;
            const buildingAddress = `${street}${number ? ' ' + number : ''}`;

            // Check if subscriber already exists
            const existingSubscriber = await query(
                `SELECT id FROM subscribers 
                WHERE circuit_id = $1 AND address = $2`,
                [circuitDbId, address]
            );

            let subscriberId;

            if (existingSubscriber.rows.length > 0) {
                // Update existing subscriber
                subscriberId = existingSubscriber.rows[0].id;
                
                await query(
                    `UPDATE subscribers 
                    SET name = $1, building_address = $2, updated_at = NOW()
                    WHERE id = $3`,
                    [name || '', buildingAddress, subscriberId]
                );

                // Delete existing products
                await query('DELETE FROM subscriber_products WHERE subscriber_id = $1', [subscriberId]);
            } else {
                // Determine order_index
                let finalOrderIndex;
                if (orderIndex !== null && orderIndex !== undefined) {
                    // Use provided order index
                    finalOrderIndex = orderIndex;
                    
                    // Shift existing subscribers to make room
                    await query(
                        `UPDATE subscribers 
                        SET order_index = order_index + 1 
                        WHERE circuit_id = $1 AND order_index >= $2`,
                        [circuitDbId, orderIndex]
                    );
                } else {
                    // Get max order_index for the circuit and add to end
                    const maxOrderResult = await query(
                        'SELECT COALESCE(MAX(order_index), 0) as max_order FROM subscribers WHERE circuit_id = $1',
                        [circuitDbId]
                    );
                    finalOrderIndex = maxOrderResult.rows[0].max_order + 1;
                }

                // Insert new subscriber
                const insertResult = await query(
                    `INSERT INTO subscribers (circuit_id, address, building_address, name, order_index)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id`,
                    [circuitDbId, address, buildingAddress, name || '', finalOrderIndex]
                );
                subscriberId = insertResult.rows[0].id;
            }

            // Insert products
            for (const product of products) {
                await query(
                    `INSERT INTO subscriber_products (subscriber_id, product_code, quantity)
                    VALUES ($1, $2, $3)`,
                    [subscriberId, product, 1]
                );
            }

            // Get the complete subscriber data to return
            const result = await query(
                `SELECT s.*, 
                    array_agg(sp.product_code) as products
                FROM subscribers s
                LEFT JOIN subscriber_products sp ON s.id = sp.id
                WHERE s.id = $1
                GROUP BY s.id`,
                [subscriberId]
            );

            logger.info(`Admin manually ${existingSubscriber.rows.length > 0 ? 'updated' : 'added'} subscriber:`, {
                circuitId,
                address,
                products
            });

            // Broadcast update to all connected clients via WebSocket
            const socketIO = await getIO();
            if (socketIO) {
                socketIO.emit('subscriber_updated', {
                    circuitId,
                    action: existingSubscriber.rows.length > 0 ? 'updated' : 'created',
                    subscriber: result.rows[0]
                });
                logger.info(`Broadcasted subscriber update for circuit ${circuitId}`);
            }

            res.json({
                success: true,
                subscriber: result.rows[0],
                action: existingSubscriber.rows.length > 0 ? 'updated' : 'created'
            });
        } catch (error) {
            logger.error('Manual subscriber add/update error:', error);
            res.status(500).json({ error: 'Failed to add/update subscriber' });
        }
    }
);

// Update subscriber key info (admin/manager only)
router.put('/subscribers/:id/key-info',
    authenticate,
    authorize('admin', 'manager'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { key_info } = req.body;

            // Validate subscriber ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({ error: 'Invalid subscriber ID' });
            }

            // Update key_info field
            const result = await query(
                `UPDATE subscribers 
                 SET key_info = $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [key_info || null, parseInt(id)]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Subscriber not found' });
            }

            const subscriber = result.rows[0];
            
            // Broadcast update to all connected clients
            const socketIO = await getIO();
            if (socketIO) {
                socketIO.emit('subscriber_updated', {
                    action: 'key_info_updated',
                    circuitId: subscriber.circuit_id,
                    subscriberId: subscriber.id,
                    subscriber: subscriber
                });
                logger.info(`Broadcasted key info update for subscriber ${id} on circuit ${subscriber.circuit_id}`);
            }

            res.json({
                success: true,
                subscriber: result.rows[0]
            });
        } catch (error) {
            logger.error('Key info update error:', error);
            res.status(500).json({ error: 'Failed to update key info' });
        }
    }
);

export default router;

