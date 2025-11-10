import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

// Get all circuits
router.get('/', authenticate, async (req, res) => {
    try {
        const result = await query(
            `SELECT c.*, 
            (SELECT COUNT(*) FROM subscribers WHERE circuit_id = c.id AND is_active = true) as subscriber_count
            FROM circuits c 
            WHERE is_active = true 
            ORDER BY circuit_id`
        );
        res.json(result.rows);
    } catch (error) {
        logger.error('Get circuits error:', error);
        res.status(500).json({ error: 'Failed to fetch circuits' });
    }
});

// Get circuit by ID with subscribers
router.get('/:circuitId', authenticate, async (req, res) => {
    try {
        const { circuitId } = req.params;
        
        const circuit = await query(
            'SELECT * FROM circuits WHERE circuit_id = $1',
            [circuitId]
        );

        if (circuit.rows.length === 0) {
            return res.status(404).json({ error: 'Circuit not found' });
        }

        const subscribers = await query(
            `SELECT s.*, 
            json_agg(json_build_object('product_code', sp.product_code, 'quantity', sp.quantity)) as products
            FROM subscribers s
            LEFT JOIN subscriber_products sp ON s.id = sp.subscriber_id AND sp.is_active = true
            WHERE s.circuit_id = $1 AND s.is_active = true
            GROUP BY s.id
            ORDER BY s.order_index, s.address`,
            [circuit.rows[0].id]
        );

        res.json({
            ...circuit.rows[0],
            subscribers: subscribers.rows
        });
    } catch (error) {
        logger.error('Get circuit error:', error);
        res.status(500).json({ error: 'Failed to fetch circuit' });
    }
});

export default router;
