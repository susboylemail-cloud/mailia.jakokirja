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
                include_deleted: 0
            },
            timeout: 10000
        });

        if (response.data && response.data.data) {
            const units = response.data.data.units || [];
            
            // Log first unit to see the structure
            if (units.length > 0) {
                console.log('Sample unit from Mapon API:', JSON.stringify(units[0], null, 2));
            }
            
            // Transform units to include license plate
            const transformedUnits = units.map((unit: any) => {
                // Extract license plate from 'number' field (e.g., "XPH-945")
                const licensePlate = unit.number || unit.label || `Unit ${unit.unit_id}`;
                
                return {
                    unit_id: unit.unit_id,
                    label: licensePlate, // Use license plate as the label
                    number: unit.number, // Keep original number field
                    licensePlate: unit.number, // Explicitly add licensePlate field
                    // Include other potentially useful fields
                    name: unit.label || unit.number,
                    active: unit.active
                };
            });
            
            res.json({ success: true, units: transformedUnits });
        } else {
            res.status(500).json({ success: false, error: 'Invalid response from Mapon API' });
        }
    } catch (error: any) {
        console.error('Mapon API error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch units from Mapon',
            details: error.response?.data || error.message 
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
        
        // Log first unit to see structure (debug)
        if (units.length > 0) {
            console.log('Sample Mapon unit data:', JSON.stringify(units[0], null, 2));
        }
        
        // Transform Mapon data to our format
        const locations = units.map((unit: any) => {
            const lat = parseFloat(unit.latitude) || 0;
            const lon = parseFloat(unit.longitude) || 0;
            const speed = parseFloat(unit.speed) || 0;
            
            // Try multiple timestamp fields
            const dt_tracker = unit.dt_tracker || unit.dt_server || unit.dt_actual || unit.gprs_time || 0;
            
            // Extract license plate from 'number' field (e.g., "XPH-945")
            const licensePlate = unit.number || unit.label || `Unit ${unit.unit_id}`;
            
            return {
                id: unit.unit_id,
                name: licensePlate, // Use license plate as display name
                licensePlate: unit.number, // Explicitly include license plate
                circuit: extractCircuitFromName(unit.label || unit.number || ''),
                lat,
                lon,
                speed,
                heading: parseFloat(unit.angle) || 0,
                status: determineStatus(unit),
                lastUpdate: dt_tracker ? new Date(dt_tracker * 1000) : new Date(),
                // Additional data
                ignition: unit.ignition === 1,
                satellites: unit.satellites || 0,
                address: unit.location_name || '',
                // Debug info - include more fields to diagnose
                rawData: {
                    dt_tracker: unit.dt_tracker,
                    dt_server: unit.dt_server,
                    dt_actual: unit.dt_actual,
                    gprs_time: unit.gprs_time,
                    hasCoords: !!(lat && lon),
                    speed: unit.speed,
                    ignition: unit.ignition,
                    number: unit.number,
                    label: unit.label
                }
            };
        });

        res.json({ success: true, locations, count: locations.length });
    } catch (error: any) {
        console.error('Mapon locations API error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch locations from Mapon',
            details: error.response?.data || error.message 
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
    // Try multiple timestamp fields
    const now = Date.now() / 1000; // Current time in seconds
    const lastUpdate = unit.dt_tracker || unit.dt_server || unit.dt_actual || unit.gprs_time || 0;
    
    // If no timestamp at all, check if we have coordinates
    if (!lastUpdate) {
        // If we have lat/lon, assume stopped (recent enough data)
        if (unit.latitude && unit.longitude) {
            const speed = parseFloat(unit.speed) || 0;
            return speed > 5 ? 'moving' : 'stopped';
        }
        return 'offline';
    }
    
    const timeDiff = now - lastUpdate;

    // If no update in 24 hours, consider offline (very lenient)
    if (timeDiff > 86400) {
        return 'offline';
    }

    const speed = parseFloat(unit.speed) || 0;

    // Moving if speed > 5 km/h
    if (speed > 5) {
        return 'moving';
    }

    // Default to stopped if we have recent data
    return 'stopped';
}

export default router;
