import express from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import logger from '../config/logger';

const router = express.Router();

// Get route times for export (Excel/CSV)
router.get('/route-times', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const userRole = req.user!.role;

        // Only admins and managers can access dashboard
        if (userRole !== 'admin' && userRole !== 'manager') {
            res.status(403).json({ error: 'Unauthorized: Admin or manager access required' });
            return;
        }

        const { startDate, endDate } = req.query;

        let queryText = `
            SELECT 
                r.id as route_id,
                r.route_date,
                c.circuit_id,
                c.circuit_name,
                u.username,
                u.full_name,
                r.start_time,
                r.end_time,
                r.status,
                CASE 
                    WHEN r.start_time IS NOT NULL AND r.end_time IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600
                    ELSE NULL
                END as total_hours,
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
            WHERE 1=1
        `;

        const params: any[] = [];

        if (startDate) {
            params.push(startDate);
            queryText += ` AND r.route_date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            queryText += ` AND r.route_date <= $${params.length}`;
        }

        queryText += ' ORDER BY r.route_date DESC, c.circuit_id';

        const result = await query(queryText, params);
        
        logger.info(`Dashboard route times fetched: ${result.rows.length} records`);
        res.json(result.rows);
    } catch (error) {
        logger.error('Get route times error:', error);
        res.status(500).json({ error: 'Failed to fetch route times' });
    }
});

// Get daily delivery statistics per circuit
router.get('/daily-stats', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const userRole = req.user!.role;

        if (userRole !== 'admin' && userRole !== 'manager') {
            res.status(403).json({ error: 'Unauthorized: Admin or manager access required' });
            return;
        }

        const { startDate, endDate } = req.query;

        let queryText = `
            SELECT 
                r.route_date,
                c.circuit_id,
                c.circuit_name,
                COUNT(DISTINCT r.id) as route_count,
                SUM(
                    (SELECT COUNT(DISTINCT s.id)
                    FROM subscribers s
                    WHERE s.circuit_id = r.circuit_id 
                    AND s.is_active = true
                    AND EXISTS (
                        SELECT 1 FROM subscriber_products sp
                        WHERE sp.subscriber_id = s.id 
                        AND sp.is_active = true
                        AND sp.product_code != 'STF'
                    ))
                ) as total_papers,
                SUM((SELECT COUNT(*) FROM deliveries WHERE route_id = r.id AND is_delivered = true)) as delivered_papers,
                COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as completed_routes
            FROM routes r
            JOIN circuits c ON r.circuit_id = c.id
            WHERE 1=1
        `;

        const params: any[] = [];

        if (startDate) {
            params.push(startDate);
            queryText += ` AND r.route_date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            queryText += ` AND r.route_date <= $${params.length}`;
        }

        queryText += ' GROUP BY r.route_date, c.circuit_id, c.circuit_name';
        queryText += ' ORDER BY r.route_date DESC, c.circuit_id';

        const result = await query(queryText, params);
        
        logger.info(`Dashboard daily stats fetched: ${result.rows.length} records`);
        res.json(result.rows);
    } catch (error) {
        logger.error('Get daily stats error:', error);
        res.status(500).json({ error: 'Failed to fetch daily statistics' });
    }
});

// Get monthly summary statistics
router.get('/monthly-stats', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const userRole = req.user!.role;

        if (userRole !== 'admin' && userRole !== 'manager') {
            res.status(403).json({ error: 'Unauthorized: Admin or manager access required' });
            return;
        }

        const { year, month } = req.query;

        let queryText = `
            SELECT 
                DATE_TRUNC('month', r.route_date) as month,
                c.circuit_id,
                c.circuit_name,
                COUNT(DISTINCT r.id) as total_routes,
                COUNT(DISTINCT r.route_date) as days_worked,
                SUM(
                    (SELECT COUNT(DISTINCT s.id)
                    FROM subscribers s
                    WHERE s.circuit_id = r.circuit_id 
                    AND s.is_active = true
                    AND EXISTS (
                        SELECT 1 FROM subscriber_products sp
                        WHERE sp.subscriber_id = s.id 
                        AND sp.is_active = true
                        AND sp.product_code != 'STF'
                    ))
                ) as total_papers,
                SUM((SELECT COUNT(*) FROM deliveries WHERE route_id = r.id AND is_delivered = true)) as delivered_papers,
                COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as completed_routes,
                AVG(
                    CASE 
                        WHEN r.start_time IS NOT NULL AND r.end_time IS NOT NULL 
                        THEN EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 3600
                        ELSE NULL
                    END
                ) as avg_hours_per_route
            FROM routes r
            JOIN circuits c ON r.circuit_id = c.id
            WHERE 1=1
        `;

        const params: any[] = [];

        if (year && month) {
            params.push(year, month);
            queryText += ` AND EXTRACT(YEAR FROM r.route_date) = $${params.length - 1}`;
            queryText += ` AND EXTRACT(MONTH FROM r.route_date) = $${params.length}`;
        } else if (year) {
            params.push(year);
            queryText += ` AND EXTRACT(YEAR FROM r.route_date) = $${params.length}`;
        }

        queryText += ' GROUP BY DATE_TRUNC(\'month\', r.route_date), c.circuit_id, c.circuit_name';
        queryText += ' ORDER BY month DESC, c.circuit_id';

        const result = await query(queryText, params);
        
        logger.info(`Dashboard monthly stats fetched: ${result.rows.length} records`);
        res.json(result.rows);
    } catch (error) {
        logger.error('Get monthly stats error:', error);
        res.status(500).json({ error: 'Failed to fetch monthly statistics' });
    }
});

// Get today's total delivery count (excluding STF)
router.get('/today-delivery-count', authenticate, async (_req: AuthRequest, res): Promise<void> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Count all products on today's routes (from delivery books), excluding STF
        const queryText = `
            SELECT 
                COUNT(DISTINCT s.id) as total_addresses,
                COALESCE(SUM(sp.quantity), 0) as total_papers,
                COUNT(DISTINCT CASE WHEN d.is_delivered = true THEN d.id END) as delivered_addresses,
                COALESCE(SUM(CASE WHEN d.is_delivered = true THEN sp.quantity ELSE 0 END), 0) as delivered_papers
            FROM routes r
            JOIN subscribers s ON r.circuit_id = s.circuit_id
            LEFT JOIN deliveries d ON d.route_id = r.id AND d.subscriber_id = s.id
            JOIN subscriber_products sp ON s.id = sp.subscriber_id
            WHERE r.route_date = $1
                AND s.is_active = true
                AND sp.product_code NOT ILIKE '%STF%'
        `;
        
        const result = await query(queryText, [today]);
        
        logger.info(`Today's delivery count fetched: ${result.rows[0]?.total_papers || 0} total papers, ${result.rows[0]?.delivered_papers || 0} delivered`);
        res.json({
            date: today,
            total_addresses: parseInt(result.rows[0]?.total_addresses || 0),
            total_papers: parseInt(result.rows[0]?.total_papers || 0),
            delivered_addresses: parseInt(result.rows[0]?.delivered_addresses || 0),
            delivered_papers: parseInt(result.rows[0]?.delivered_papers || 0)
        });
    } catch (error) {
        logger.error('Get today delivery count error:', error);
        res.status(500).json({ error: 'Failed to fetch today\'s delivery count' });
    }
});

// Get delivery count for a specific period (monthly or yearly)
router.get('/period-delivery-count', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const { year, month } = req.query;
        
        if (!year) {
            res.status(400).json({ error: 'Year is required' });
            return;
        }
        
        // Count all products on routes for the period (from delivery books), excluding STF
        let queryText = `
            SELECT 
                COUNT(DISTINCT s.id) as total_addresses,
                COALESCE(SUM(sp.quantity), 0) as total_papers,
                COUNT(DISTINCT CASE WHEN d.is_delivered = true THEN d.id END) as delivered_addresses,
                COALESCE(SUM(CASE WHEN d.is_delivered = true THEN sp.quantity ELSE 0 END), 0) as delivered_papers
            FROM routes r
            JOIN subscribers s ON r.circuit_id = s.circuit_id
            LEFT JOIN deliveries d ON d.route_id = r.id AND d.subscriber_id = s.id
            JOIN subscriber_products sp ON s.id = sp.subscriber_id
            WHERE EXTRACT(YEAR FROM r.route_date) = $1
                AND s.is_active = true
                AND sp.product_code NOT ILIKE '%STF%'
        `;
        
        const params: any[] = [year];
        
        if (month) {
            params.push(month);
            queryText += ` AND EXTRACT(MONTH FROM r.route_date) = $${params.length}`;
        }
        
        const result = await query(queryText, params);
        
        logger.info(`Period delivery count fetched: ${result.rows[0]?.total_papers || 0} total papers, ${result.rows[0]?.delivered_papers || 0} delivered`);
        res.json({
            year: parseInt(year as string),
            month: month ? parseInt(month as string) : null,
            total_addresses: parseInt(result.rows[0]?.total_addresses || 0),
            total_papers: parseInt(result.rows[0]?.total_papers || 0),
            delivered_addresses: parseInt(result.rows[0]?.delivered_addresses || 0),
            delivered_papers: parseInt(result.rows[0]?.delivered_papers || 0)
        });
    } catch (error) {
        logger.error('Get period delivery count error:', error);
        res.status(500).json({ error: 'Failed to fetch period delivery count' });
    }
});

// Get daily delivery counts for a month (for monthly report export)
router.get('/monthly-delivery-report', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const { year, month } = req.query;
        
        if (!year || !month) {
            res.status(400).json({ error: 'Year and month are required' });
            return;
        }
        
        // Get daily breakdown of all products on routes for the month
        const queryText = `
            SELECT 
                r.route_date,
                COUNT(DISTINCT s.id) as total_addresses,
                COALESCE(SUM(sp.quantity), 0) as total_papers,
                COUNT(DISTINCT CASE WHEN d.is_delivered = true THEN d.id END) as delivered_addresses,
                COALESCE(SUM(CASE WHEN d.is_delivered = true THEN sp.quantity ELSE 0 END), 0) as delivered_papers
            FROM routes r
            JOIN subscribers s ON r.circuit_id = s.circuit_id
            LEFT JOIN deliveries d ON d.route_id = r.id AND d.subscriber_id = s.id
            JOIN subscriber_products sp ON s.id = sp.subscriber_id
            WHERE EXTRACT(YEAR FROM r.route_date) = $1
                AND EXTRACT(MONTH FROM r.route_date) = $2
                AND s.is_active = true
                AND sp.product_code NOT ILIKE '%STF%'
            GROUP BY r.route_date
            ORDER BY r.route_date
        `;
        
        const result = await query(queryText, [year, month]);
        
        logger.info(`Monthly delivery report fetched: ${result.rows.length} days`);
        res.json(result.rows);
    } catch (error) {
        logger.error('Get monthly delivery report error:', error);
        res.status(500).json({ error: 'Failed to fetch monthly delivery report' });
    }
});

// Store/update daily delivery statistics
router.post('/store-daily-stats', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const userRole = req.user!.role;
        if (userRole !== 'admin' && userRole !== 'manager') {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const { statDate } = req.body;
        const targetDate = statDate || new Date().toISOString().split('T')[0];

        // Get stats for each circuit for the specified date
        const statsQuery = `
            INSERT INTO daily_delivery_stats (
                stat_date, circuit_id, total_addresses, total_papers, 
                delivered_addresses, delivered_papers, routes_count, completed_routes
            )
            SELECT 
                $1::date as stat_date,
                c.circuit_id,
                COUNT(DISTINCT s.id) as total_addresses,
                COALESCE(SUM(sp.quantity), 0) as total_papers,
                COUNT(DISTINCT CASE WHEN d.is_delivered = true THEN d.id END) as delivered_addresses,
                COALESCE(SUM(CASE WHEN d.is_delivered = true THEN sp.quantity ELSE 0 END), 0) as delivered_papers,
                COUNT(DISTINCT r.id) as routes_count,
                COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as completed_routes
            FROM circuits c
            LEFT JOIN routes r ON r.circuit_id = c.id AND r.route_date = $1::date
            LEFT JOIN subscribers s ON s.circuit_id = c.circuit_id AND s.is_active = true
            LEFT JOIN deliveries d ON d.route_id = r.id AND d.subscriber_id = s.id
            LEFT JOIN subscriber_products sp ON sp.subscriber_id = s.id AND sp.is_active = true AND sp.product_code NOT ILIKE '%STF%'
            GROUP BY c.circuit_id
            ON CONFLICT (stat_date, circuit_id) 
            DO UPDATE SET
                total_addresses = EXCLUDED.total_addresses,
                total_papers = EXCLUDED.total_papers,
                delivered_addresses = EXCLUDED.delivered_addresses,
                delivered_papers = EXCLUDED.delivered_papers,
                routes_count = EXCLUDED.routes_count,
                completed_routes = EXCLUDED.completed_routes,
                updated_at = CURRENT_TIMESTAMP
        `;

        await query(statsQuery, [targetDate]);
        logger.info(`Daily stats stored for ${targetDate}`);
        res.json({ message: 'Daily statistics stored successfully', date: targetDate });
    } catch (error) {
        logger.error('Store daily stats error:', error);
        res.status(500).json({ error: 'Failed to store daily statistics' });
    }
});

// Store/update monthly delivery statistics
router.post('/store-monthly-stats', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const userRole = req.user!.role;
        if (userRole !== 'admin' && userRole !== 'manager') {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const { year, month } = req.body;
        const targetYear = year || new Date().getFullYear();
        const targetMonth = month || new Date().getMonth() + 1;

        const statsQuery = `
            INSERT INTO monthly_delivery_stats (
                year, month, circuit_id, total_addresses, total_papers,
                delivered_addresses, delivered_papers, routes_count, completed_routes
            )
            SELECT 
                $1::integer as year,
                $2::integer as month,
                c.circuit_id,
                COUNT(DISTINCT s.id) as total_addresses,
                COALESCE(SUM(sp.quantity), 0) as total_papers,
                COUNT(DISTINCT CASE WHEN d.is_delivered = true THEN d.id END) as delivered_addresses,
                COALESCE(SUM(CASE WHEN d.is_delivered = true THEN sp.quantity ELSE 0 END), 0) as delivered_papers,
                COUNT(DISTINCT r.id) as routes_count,
                COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as completed_routes
            FROM circuits c
            LEFT JOIN routes r ON r.circuit_id = c.id 
                AND EXTRACT(YEAR FROM r.route_date) = $1
                AND EXTRACT(MONTH FROM r.route_date) = $2
            LEFT JOIN subscribers s ON s.circuit_id = c.circuit_id AND s.is_active = true
            LEFT JOIN deliveries d ON d.route_id = r.id AND d.subscriber_id = s.id
            LEFT JOIN subscriber_products sp ON sp.subscriber_id = s.id AND sp.is_active = true AND sp.product_code NOT ILIKE '%STF%'
            GROUP BY c.circuit_id
            ON CONFLICT (year, month, circuit_id)
            DO UPDATE SET
                total_addresses = EXCLUDED.total_addresses,
                total_papers = EXCLUDED.total_papers,
                delivered_addresses = EXCLUDED.delivered_addresses,
                delivered_papers = EXCLUDED.delivered_papers,
                routes_count = EXCLUDED.routes_count,
                completed_routes = EXCLUDED.completed_routes,
                updated_at = CURRENT_TIMESTAMP
        `;

        await query(statsQuery, [targetYear, targetMonth]);
        logger.info(`Monthly stats stored for ${targetYear}-${targetMonth}`);
        res.json({ message: 'Monthly statistics stored successfully', year: targetYear, month: targetMonth });
    } catch (error) {
        logger.error('Store monthly stats error:', error);
        res.status(500).json({ error: 'Failed to store monthly statistics' });
    }
});

// Store/update yearly delivery statistics
router.post('/store-yearly-stats', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const userRole = req.user!.role;
        if (userRole !== 'admin' && userRole !== 'manager') {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const { year } = req.body;
        const targetYear = year || new Date().getFullYear();

        const statsQuery = `
            INSERT INTO yearly_delivery_stats (
                year, circuit_id, total_addresses, total_papers,
                delivered_addresses, delivered_papers, routes_count, completed_routes
            )
            SELECT 
                $1::integer as year,
                c.circuit_id,
                COUNT(DISTINCT s.id) as total_addresses,
                COALESCE(SUM(sp.quantity), 0) as total_papers,
                COUNT(DISTINCT CASE WHEN d.is_delivered = true THEN d.id END) as delivered_addresses,
                COALESCE(SUM(CASE WHEN d.is_delivered = true THEN sp.quantity ELSE 0 END), 0) as delivered_papers,
                COUNT(DISTINCT r.id) as routes_count,
                COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as completed_routes
            FROM circuits c
            LEFT JOIN routes r ON r.circuit_id = c.id AND EXTRACT(YEAR FROM r.route_date) = $1
            LEFT JOIN subscribers s ON s.circuit_id = c.circuit_id AND s.is_active = true
            LEFT JOIN deliveries d ON d.route_id = r.id AND d.subscriber_id = s.id
            LEFT JOIN subscriber_products sp ON sp.subscriber_id = s.id AND sp.is_active = true AND sp.product_code NOT ILIKE '%STF%'
            GROUP BY c.circuit_id
            ON CONFLICT (year, circuit_id)
            DO UPDATE SET
                total_addresses = EXCLUDED.total_addresses,
                total_papers = EXCLUDED.total_papers,
                delivered_addresses = EXCLUDED.delivered_addresses,
                delivered_papers = EXCLUDED.delivered_papers,
                routes_count = EXCLUDED.routes_count,
                completed_routes = EXCLUDED.completed_routes,
                updated_at = CURRENT_TIMESTAMP
        `;

        await query(statsQuery, [targetYear]);
        logger.info(`Yearly stats stored for ${targetYear}`);
        res.json({ message: 'Yearly statistics stored successfully', year: targetYear });
    } catch (error) {
        logger.error('Store yearly stats error:', error);
        res.status(500).json({ error: 'Failed to store yearly statistics' });
    }
});

// Get historical monthly stats
router.get('/historical-monthly-stats', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const { year, month, circuitId } = req.query;
        
        let queryText = 'SELECT * FROM monthly_delivery_stats WHERE 1=1';
        const params: any[] = [];
        
        if (year) {
            params.push(year);
            queryText += ` AND year = $${params.length}`;
        }
        if (month) {
            params.push(month);
            queryText += ` AND month = $${params.length}`;
        }
        if (circuitId) {
            params.push(circuitId);
            queryText += ` AND circuit_id = $${params.length}`;
        }
        
        queryText += ' ORDER BY year DESC, month DESC, circuit_id';
        
        const result = await query(queryText, params);
        res.json(result.rows);
    } catch (error) {
        logger.error('Get historical monthly stats error:', error);
        res.status(500).json({ error: 'Failed to fetch historical monthly statistics' });
    }
});

// Get historical yearly stats
router.get('/historical-yearly-stats', authenticate, async (req: AuthRequest, res): Promise<void> => {
    try {
        const { year, circuitId } = req.query;
        
        let queryText = 'SELECT * FROM yearly_delivery_stats WHERE 1=1';
        const params: any[] = [];
        
        if (year) {
            params.push(year);
            queryText += ` AND year = $${params.length}`;
        }
        if (circuitId) {
            params.push(circuitId);
            queryText += ` AND circuit_id = $${params.length}`;
        }
        
        queryText += ' ORDER BY year DESC, circuit_id';
        
        const result = await query(queryText, params);
        res.json(result.rows);
    } catch (error) {
        logger.error('Get historical yearly stats error:', error);
        res.status(500).json({ error: 'Failed to fetch historical yearly statistics' });
    }
});

export default router;

