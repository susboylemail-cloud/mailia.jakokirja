# Mapon GPS API Integration - Activation Guide

## Status
✅ **Backend routes implemented** (`src/routes/mapon.ts`)
✅ **Server configured** (routes registered in `server.ts`)
✅ **Frontend updated** (`app.js` - using real API endpoints)
✅ **Environment variables added** (`.env` and `.env.production`)
⚠️ **Dependency installation needed** (axios)

## Quick Activation Steps

### For Local Development

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/
   - Required version: Node 18.x or higher

2. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```
   This will install axios and all other required packages.

3. **Verify .env file**
   ```bash
   # Check that backend/.env exists and contains:
   MAPON_API_KEY=b6a5ce738b76b134d06e8b072a754918019a9ed7
   ```
   ✅ Already created automatically!

4. **Start the backend server**
   ```bash
   npm run dev
   ```

5. **Test the integration**
   - Login as admin user
   - Navigate to "Seuranta" tab
   - Click "Aloita seuranta" (Start tracking)
   - Real driver locations should appear on the map

### For Heroku Production

The integration will be automatically activated on next deployment:

1. **Automatic dependency installation**
   - Heroku runs `npm install` during deployment
   - Axios will be installed automatically from `package.json`

2. **Environment variable**
   - Set in Heroku dashboard or via CLI:
   ```bash
   heroku config:set MAPON_API_KEY=b6a5ce738b76b134d06e8b072a754918019a9ed7
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

## API Endpoints Created

### 1. GET /api/mapon/locations
Returns real-time driver locations for all active units.

**Response format:**
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
      "lastUpdate": "2025-11-13T10:30:00.000Z",
      "ignition": true,
      "satellites": 12,
      "address": "Vuoksenniskantie 123"
    }
  ]
}
```

### 2. GET /api/mapon/units
Returns raw unit data from Mapon API.

### 3. GET /api/mapon/route/:unitId
Returns route history for specific unit.

**Query params:**
- `from`: Unix timestamp (start time)
- `till`: Unix timestamp (end time)

## How It Works

```
Frontend (app.js)
    ↓ fetchDriverLocations()
    ↓ GET /api/mapon/locations (with JWT token)
    ↓
Backend (server.ts → mapon.ts)
    ↓ axios.get(mapon.com/api/v1/unit/list.json)
    ↓ Transform data format
    ↓ Return to frontend
    ↓
Frontend receives locations
    ↓ updateGPSMarkers() - Draw on Leaflet map
    ↓ renderDriverList() - Show driver cards
```

## Data Transformation

### Mapon API → App Format

| Mapon Field | App Field | Transformation |
|------------|-----------|----------------|
| `unit_id` | `id` | Direct mapping |
| `name` | `name` | Direct or fallback to `number` |
| Extracted | `circuit` | Regex: `/\b(KP[A-Z]?\d+[A-B]?|K\d+)\b/i` |
| `latitude` | `lat` | Parse float |
| `longitude` | `lon` | Parse float |
| `speed` | `speed` | Parse float (km/h) |
| `angle` | `heading` | Parse float (0-360°) |
| Calculated | `status` | moving/stopped/offline |
| `dt_tracker` | `lastUpdate` | Unix timestamp → Date |

### Status Logic

```javascript
if (lastUpdate > 5 minutes ago) {
    return 'offline';
} else if (speed > 5 km/h && ignition === true) {
    return 'moving';
} else {
    return 'stopped';
}
```

## Circuit Name Extraction

For automatic circuit assignment, ensure unit names in Mapon include circuit IDs:

**Supported patterns:**
- `KP3`, `KP10`, `KP32A`, `KP55B` (standard circuits)
- `KPR1`, `KPR5` (reserve circuits)
- `K28` (special circuits)

**Examples:**
- "Jakelija 1 - KP3" → Circuit: `KP3` ✅
- "Unit KP10" → Circuit: `KP10` ✅
- "Driver 5" → Circuit: `N/A` ⚠️

## Testing

### 1. Test Backend API Directly
```bash
# Get JWT token first (login via /api/auth/login)
# Then test Mapon endpoint:
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/mapon/locations
```

### 2. Check Logs
```bash
# Backend logs will show:
# - Mapon API requests
# - Response data
# - Any errors
```

### 3. Browser Console
Open browser DevTools → Console, look for:
- GPS tracking initialization
- Fetch requests to `/api/mapon/locations`
- Marker updates
- Any errors

## Troubleshooting

### "Cannot find module 'axios'"
**Solution:** Run `npm install` in backend directory

### "MAPON_API_KEY is not defined"
**Solution:** Verify `.env` file exists and contains the API key

### No drivers appearing
**Possible causes:**
1. No units in Mapon system
2. Units offline (no data in last 5 minutes)
3. API key invalid
4. Network/firewall blocking mapon.com

**Debug:**
- Check backend logs for API errors
- Test Mapon API directly: https://mapon.com/api/v1/unit/list.json?key=YOUR_KEY
- Verify units exist in Mapon dashboard

### Map not loading
**Causes:**
- Leaflet CDN blocked
- JavaScript errors in console

**Solution:**
- Check browser console for errors
- Verify internet connection
- Try different browser

## Security Notes

✅ **API key in backend only** - Never exposed to frontend
✅ **JWT authentication required** - All endpoints protected
✅ **Rate limiting enabled** - Prevents API abuse
✅ **HTTPS in production** - Encrypted communication

## Performance

- **Polling interval:** 30 seconds (configurable in `app.js`)
- **API timeout:** 10 seconds for location data
- **Caching:** None (always fresh data)

To reduce API calls, increase `GPS_UPDATE_INTERVAL` in `app.js`:
```javascript
const GPS_UPDATE_INTERVAL = 60000; // 60 seconds instead of 30
```

## Next Steps After Activation

1. **Configure unit names** in Mapon dashboard to include circuit IDs
2. **Test with real vehicles** to verify location accuracy
3. **Adjust polling interval** based on actual usage needs
4. **Monitor API usage** to avoid rate limits
5. **Set up error alerts** for production monitoring

## Support

If you encounter issues:
1. Check backend logs
2. Review `MAPON_INTEGRATION.md` for detailed documentation
3. Test Mapon API directly to isolate issues
4. Verify network connectivity to mapon.com

---

**Integration Status:** Ready for activation
**Last Updated:** November 13, 2025
**Version:** 1.0.0
