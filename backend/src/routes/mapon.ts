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
        
        // Log ALL coordinate-related fields from first unit to diagnose the issue
        if (units.length > 0) {
            console.log('=== MAPON API COORDINATE DEBUGGING ===');
            console.log('Full first unit data:', JSON.stringify(units[0], null, 2));
            console.log('Coordinate fields:');
            console.log('  latitude:', units[0].latitude);
            console.log('  longitude:', units[0].longitude);
            console.log('  lat:', units[0].lat);
            console.log('  lon:', units[0].lon);
            console.log('  lng:', units[0].lng);
            console.log('  gpslat:', units[0].gpslat);
            console.log('  gpslon:', units[0].gpslon);
            console.log('=====================================');
        }
        
        // Transform Mapon data to our format
        const locations = units.map((unit: any) => {
            // Try different possible coordinate field names from Mapon API
            let lat = parseFloat(unit.lat || unit.latitude || unit.gpslat || '0');
            let lon = parseFloat(unit.lon || unit.lng || unit.longitude || unit.gpslon || '0');
            
            console.log(`Unit ${unit.unit_id} (${unit.number}): Original coords = lat:${lat}, lon:${lon}`);
            
            // For Finland: lat should be ~60-70, lon should be ~20-32
            // If we have valid coordinates but they seem swapped, fix them
            if (lat !== 0 && lon !== 0) {
                // If latitude value is in typical longitude range (20-32) and 
                // longitude value is in typical latitude range (60-70), they're swapped
                if (lat >= 20 && lat <= 32 && lon >= 60 && lon <= 70) {
                    console.log(`  -> SWAPPING: lat ${lat} is in lon range, lon ${lon} is in lat range`);
                    [lat, lon] = [lon, lat];
                    console.log(`  -> After swap: lat:${lat}, lon:${lon}`);
                }
            }
            
            const speed = parseFloat(unit.speed) || 0;
            
            // Try multiple timestamp fields (Mapon uses Unix timestamps in seconds)
            const dt_tracker = unit.dt_tracker || unit.dt_server || unit.dt_actual || unit.gprs_time || 0;
            
            // Create proper date object, or null if no valid timestamp
            let lastUpdate: Date | null = null;
            if (dt_tracker && dt_tracker > 0) {
                lastUpdate = new Date(dt_tracker * 1000); // Convert Unix timestamp to milliseconds
            }
            
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
                lastUpdate: lastUpdate ? lastUpdate.toISOString() : null, // Send as ISO string for JSON
                lastUpdateTimestamp: dt_tracker, // Include raw timestamp for debugging
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
