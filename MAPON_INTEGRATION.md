# Mapon GPS Tracking Integration

## Overview
This document describes the Mapon API integration for real-time GPS tracking of delivery drivers.

## API Configuration

### Environment Variables
Add to `backend/.env`:
```bash
MAPON_API_KEY=b6a5ce738b76b134d06e8b072a754918019a9ed7
```

### Installation
The backend requires axios for HTTP requests:
```bash
cd backend
npm install axios
```

## Architecture

### Backend Endpoints

#### GET /api/mapon/units
Returns all units (vehicles) from Mapon.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Response:**
```json
{
  "success": true,
  "units": [...]
}
```

#### GET /api/mapon/locations
Returns transformed location data for all active units.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Response:**
```json
{
  "success": true,
  "locations": [
    {
      "id": 123,
      "name": "Jakelija 1",
      "circuit": "KP3",
      "lat": 61.1750,
      "lon": 28.7600,
      "speed": 25,
      "heading": 180,
      "status": "moving",
      "lastUpdate": "2024-01-15T10:30:00.000Z",
      "ignition": true,
      "satellites": 12,
      "address": "Vuoksenniskantie 123"
    }
  ]
}
```

#### GET /api/mapon/route/:unitId
Returns route history for a specific unit.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Query Parameters:**
- `from`: Unix timestamp (start time)
- `till`: Unix timestamp (end time)

**Response:**
```json
{
  "success": true,
  "route": {...}
}
```

### Frontend Integration

The frontend calls the backend proxy endpoints instead of directly accessing Mapon API (to avoid CORS issues).

**Location:** `app.js` function `fetchDriverLocations()`

```javascript
const response = await fetch(`${API_URL}/mapon/locations`, {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});
```

## Data Mapping

### Mapon API → App Format

| Mapon Field | App Field | Description |
|------------|-----------|-------------|
| `unit_id` | `id` | Unique unit identifier |
| `name` or `number` | `name` | Driver/unit name |
| Extracted from `name` | `circuit` | Postal circuit (e.g., KP3) |
| `latitude` | `lat` | Latitude coordinate |
| `longitude` | `lon` | Longitude coordinate |
| `speed` | `speed` | Speed in km/h |
| `angle` | `heading` | Direction in degrees (0-360) |
| Calculated | `status` | moving/stopped/offline |
| `dt_tracker` | `lastUpdate` | Last GPS update timestamp |
| `ignition` | `ignition` | Engine on/off |
| `satellites` | `satellites` | GPS satellite count |
| `location_name` | `address` | Reverse geocoded address |

### Status Determination Logic

```javascript
function determineStatus(unit) {
    const now = Date.now() / 1000;
    const lastUpdate = unit.dt_tracker || 0;
    const timeDiff = now - lastUpdate;

    // Offline if no update in 5 minutes
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
```

## Circuit Extraction

Unit names should include circuit identifiers for automatic assignment:

**Examples:**
- "Jakelija 1 - KP3" → Circuit: `KP3`
- "Unit KP10" → Circuit: `KP10`
- "Imatra K28" → Circuit: `K28`

**Regex Pattern:** `/\b(KP[A-Z]?\d+[A-B]?|K\d+)\b/i`

## Polling Configuration

Frontend polls every 30 seconds when GPS tracking is active:

```javascript
const GPS_UPDATE_INTERVAL = 30000; // 30 seconds
```

To change, modify `startGPSTracking()` in `app.js`.

## Error Handling

### Backend Errors
- API timeout: 10 seconds for unit list, 15 seconds for routes
- Invalid API key: Returns 500 with error message
- Network errors: Logged to console, returns error to frontend

### Frontend Errors
- Authentication failure: Shows error message
- Network timeout: Displays "Ei voitu hakea sijainteja"
- Invalid response: Shows error with details

## Security

- API key stored in backend environment variables only
- Frontend never accesses Mapon API directly
- JWT authentication required for all backend endpoints
- Admin/manager role required to view GPS tracking section

## Testing

### Manual Testing
1. Start backend: `cd backend && npm run dev`
2. Login as admin user
3. Navigate to "Seuranta" tab
4. Click "Aloita seuranta"
5. Map should load with real driver locations

### API Testing
```bash
# Get locations (replace with actual JWT token)
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/mapon/locations

# Get specific route
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/mapon/route/123?from=1705320000&till=1705406400"
```

## Troubleshooting

### No drivers appearing on map
1. Check backend logs for API errors
2. Verify MAPON_API_KEY is set correctly
3. Confirm units exist in Mapon dashboard
4. Check unit names include circuit identifiers

### "Offline" status for all units
- Mapon data may be stale (dt_tracker > 5 minutes old)
- Check Mapon API for recent updates

### Map not loading
- Leaflet CDN may be blocked
- Check browser console for errors
- Verify internet connection

## Mapon API Documentation

Official docs: https://mapon.com/api/

**Base URL:** `https://mapon.com/api/v1`

**Authentication:** API key via query parameter `?key=<api_key>`

**Key Endpoints:**
- `/unit/list.json` - List all units
- `/route/list.json` - Get route history
- `/report/list.json` - Get various reports

## Future Enhancements

- [ ] Real-time WebSocket updates from Mapon
- [ ] Historical route playback
- [ ] Geofencing alerts
- [ ] Speed violation tracking
- [ ] Daily mileage reports
- [ ] Custom circuit assignments in database
