import express, { Request, Response } from 'express';
import axios from 'axios';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Mapon API configuration
const MAPON_API_KEY = process.env.MAPON_API_KEY || 'b6a5ce738b76b134d06e8b072a754918019a9ed7';
const MAPON_API_BASE = 'https://mapon.com/api/v1';

/**
 * Get all units (vehicles/drivers) from Mapon
 * GET /api/mapon/units
 */
router.get('/units', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const response = await axios.get(`${MAPON_API_BASE}/unit/list.json`, {
            params: {
                key: MAPON_API_KEY,
                include_deleted: 0 // Only active units
            },
            timeout: 10000 // 10 second timeout
        });

        if (response.data && response.data.data) {
            const units = response.data.data.units || [];
            res.json({ success: true, units });
        } else {
            res.status(500).json({ success: false, error: 'Invalid response from Mapon API' });
        }
    } catch (error: any) {
        console.error('Mapon API error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch units from Mapon',
            details: error.message 
        });
    }
});

/**
 * Get current location data for all units
 * GET /api/mapon/locations
 */
router.get('/locations', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const response = await axios.get(`${MAPON_API_BASE}/unit/list.json`, {
            params: {
                key: MAPON_API_KEY,
                include_deleted: 0
            },
            timeout: 10000
        });

        if (!response.data || !response.data.data) {
            return res.status(500).json({ success: false, error: 'Invalid response from Mapon API' });
        }

        const units = response.data.data.units || [];
        
        // Transform Mapon data to our format
        const locations = units.map((unit: any) => ({
            id: unit.unit_id,
            name: unit.name || unit.number || `Unit ${unit.unit_id}`,
            circuit: extractCircuitFromName(unit.name || ''),
            lat: parseFloat(unit.latitude) || 0,
            lon: parseFloat(unit.longitude) || 0,
            speed: parseFloat(unit.speed) || 0,
            heading: parseFloat(unit.angle) || 0,
            status: determineStatus(unit),
            lastUpdate: unit.dt_tracker ? new Date(unit.dt_tracker * 1000) : new Date(),
            // Additional data
            ignition: unit.ignition === 1,
            satellites: unit.satellites || 0,
            address: unit.location_name || ''
        }));

        res.json({ success: true, locations });
    } catch (error: any) {
        console.error('Mapon locations API error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch locations from Mapon',
            details: error.message 
        });
    }
});

/**
 * Get route history for a specific unit
 * GET /api/mapon/route/:unitId
 */
router.get('/route/:unitId', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { unitId } = req.params;
        const { from, till } = req.query;

        if (!from || !till) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required parameters: from and till timestamps' 
            });
        }

        const response = await axios.get(`${MAPON_API_BASE}/route/list.json`, {
            params: {
                key: MAPON_API_KEY,
                unit_id: unitId,
                from: from,
                till: till
            },
            timeout: 15000
        });

        if (response.data && response.data.data) {
            res.json({ success: true, route: response.data.data });
        } else {
            res.status(500).json({ success: false, error: 'Invalid response from Mapon API' });
        }
    } catch (error: any) {
        console.error('Mapon route API error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch route from Mapon',
            details: error.message 
        });
    }
});

/**
 * Helper: Extract circuit ID from unit name
 */
function extractCircuitFromName(name: string): string {
    // Try to extract circuit pattern like KP3, KP10, etc.
    const match = name.match(/\b(KP[A-Z]?\d+[A-B]?|K\d+)\b/i);
    return match ? match[1].toUpperCase() : 'N/A';
}

/**
 * Helper: Determine unit status based on Mapon data
 */
function determineStatus(unit: any): 'moving' | 'stopped' | 'offline' {
    const now = Date.now() / 1000; // Current time in seconds
    const lastUpdate = unit.dt_tracker || 0;
    const timeDiff = now - lastUpdate;

    // If no update in 5 minutes, consider offline
    if (timeDiff > 300) {
        return 'offline';
    }

    const speed = parseFloat(unit.speed) || 0;
    const ignition = unit.ignition === 1;

    // Moving if speed > 5 km/h and ignition on
    if (speed > 5 && ignition) {
        return 'moving';
    }

    return 'stopped';
}

export default router;
