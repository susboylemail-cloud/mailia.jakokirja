# Mapon View Fixes - License Plates & Debugging

## Summary

This document describes the fixes applied to the Mapon GPS tracking integration to address:
1. **License plate display** - Vehicles now show license plates instead of unit names
2. **Enhanced debugging** - Comprehensive logging to diagnose sync and offline issues

## Issues Fixed

### 1. License Plate Display ✅

**Problem:** 
- Vehicle dropdown showed unit names/labels instead of license plates
- GPS tracking view showed driver names instead of vehicle identifiers
- Made it difficult to identify which physical vehicle was being tracked

**Root Cause:**
- Backend wasn't extracting the license plate field from Mapon API
- Frontend was using `unit.label` or `unit.number` which contain driver/unit names
- Mapon API provides license plates in fields like `licence_number`, `licenceNumber`, or `plateNumber`

**Solution:**
- Backend now extracts `plateNumber` from multiple possible field names
- Frontend prioritizes displaying license plates with fallback to names
- Applied to: vehicle dropdown, driver list, map markers, and popups

### 2. Enhanced Debugging ✅

**Problem:**
- Limited visibility into why cars might appear offline
- Difficult to diagnose sync issues or stale data
- No easy way to identify API communication problems

**Solution:**
- Added comprehensive logging throughout Mapon integration
- All logs prefixed with `[Mapon]` for easy filtering
- Includes: API call status, unit counts, transformation results, errors
- Frontend logs include all relevant fields: id, name, plateNumber, status, coordinates

## Technical Changes

### Backend Changes (`backend/src/routes/mapon.ts`)

#### 1. `/api/mapon/units` endpoint
```typescript
// Now includes plateNumber field
const transformedUnits = units.map((unit: any) => ({
    ...unit,
    plateNumber: unit.licence_number || unit.licenceNumber || 
                 unit.plateNumber || unit.plate_number || ''
}));
```

#### 2. `/api/mapon/locations` endpoint
```typescript
// Extracts plateNumber from multiple field variants
const plateNumber = unit.licence_number || unit.licenceNumber || 
                    unit.plateNumber || unit.plate_number || '';

// Includes in response
return {
    id: unit.unit_id,
    name: unit.label || unit.number || `Unit ${unit.unit_id}`,
    plateNumber: plateNumber,  // NEW FIELD
    circuit: extractCircuitFromName(unit.label || unit.number || ''),
    // ... other fields
};
```

#### 3. Enhanced Logging
```typescript
console.log('[Mapon] Fetching locations from Mapon API...');
console.log(`[Mapon] Received ${units.length} units from API`);
console.log('[Mapon] Sample unit data:', JSON.stringify(units[0], null, 2));
console.log(`[Mapon] Transformed ${locations.length} locations successfully`);
```

### Frontend Changes (`app.js`)

#### 1. Vehicle Dropdown (Line ~9196)
```javascript
// OLD:
option.textContent = unit.label || unit.number || `Auto ${unit.unit_id}`;

// NEW: Prioritizes license plates
const displayName = unit.plateNumber || unit.label || unit.number || `Auto ${unit.unit_id}`;
option.textContent = displayName;
```

#### 2. GPS Driver List (Line ~9265)
```javascript
// OLD:
<div class="gps-driver-name">${driver.name}</div>

// NEW: Shows license plates
const displayName = driver.plateNumber || driver.name;
<div class="gps-driver-name">${displayName}</div>
```

#### 3. GPS Map Markers (Line ~9105)
```javascript
// OLD:
<span class="gps-marker-label">${driver.name}</span>

// NEW: Shows license plates
const displayName = driver.plateNumber || driver.name;
<span class="gps-marker-label">${displayName}</span>
```

#### 4. Enhanced Console Logging
```javascript
console.log(`Fetched ${driverData.length} drivers:`, driverData.map(d => ({
    id: d.id,
    name: d.name,
    plateNumber: d.plateNumber,  // NEW
    status: d.status,
    lat: d.lat,
    lon: d.lon,
    lastUpdate: d.lastUpdate,
    rawData: d.rawData
})));
```

## Testing Guide

### 1. Test License Plate Display

**Vehicle Dropdown (in Circuit View):**
1. Login to the application
2. Select any circuit (e.g., KP3, KP10)
3. Look at the "Valitse auto" dropdown
4. **Expected:** Should show license plates (e.g., "ABC-123") instead of driver names
5. **Fallback:** If no plate number, will show unit label/name

**GPS Tracking View:**
1. Login as admin
2. Click "Seuranta" tab to open GPS tracking
3. Click "Aloita seuranta" button
4. Wait for drivers to load
5. **Expected in driver list:** Each card shows license plate as the main identifier
6. **Expected on map:** Markers show license plates as labels
7. **Expected in popup:** Click a marker - popup shows license plate

### 2. Test Debugging Features

**Check Backend Logs:**
```bash
# If running locally:
cd backend && npm run dev

# If deployed on Heroku:
heroku logs --tail --app YOUR_APP_NAME
```

Look for logs like:
```
[Mapon] Fetching locations from Mapon API...
[Mapon] Received 5 units from API
[Mapon] Sample unit data: { ... }
[Mapon] Transformed 5 locations successfully
```

**Check Frontend Console:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Start GPS tracking
4. Look for logs:
```javascript
Mapon API response: { success: true, locations: [...], count: 5 }
Fetched 5 drivers: [
  {
    id: 123,
    name: "Driver Name",
    plateNumber: "ABC-123",  // Should be present
    status: "moving",
    // ...
  }
]
```

### 3. Diagnose "Offline" Status Issues

If cars appear offline, check the `rawData` in console logs:

```javascript
{
  rawData: {
    dt_tracker: 1699876543,     // Timestamp in seconds
    dt_server: 1699876543,
    hasCoords: true,            // Should be true
    speed: 0,
    ignition: 1,
    licence_number: "ABC-123",  // Check which field has the plate
    licenceNumber: null,
    plateNumber: null,
    plate_number: null
  }
}
```

**Common Causes:**
1. **No timestamp** - `dt_tracker`, `dt_server`, etc. are all 0 or null
2. **Stale data** - Timestamp is > 24 hours old
3. **No coordinates** - `hasCoords: false` means lat/lon are missing
4. **API timeout** - Check backend logs for timeout errors

## Backward Compatibility

All changes maintain backward compatibility:

1. **Fallback logic:** If `plateNumber` is not available, falls back to `name`/`label`/`number`
2. **No breaking changes:** Existing API structure unchanged, only additions
3. **Graceful degradation:** Works with old and new Mapon API field names

## Field Name Variants Supported

The code checks multiple possible field names from Mapon API:
- `licence_number` (UK spelling)
- `licenceNumber` (camelCase UK spelling)
- `plateNumber` (camelCase)
- `plate_number` (snake_case)

If Mapon uses a different field name, you can add it to the backend transformation.

## Next Steps

### If License Plates Still Don't Show:

1. **Check Mapon API response:**
   - Look at backend logs for "Sample unit data"
   - Identify what field contains the license plate
   - Update backend code if field name is different

2. **Check if plates are configured in Mapon:**
   - Login to Mapon dashboard
   - Go to Units/Vehicles
   - Verify license plates are entered

3. **Check browser console:**
   - Look for `plateNumber` field in logged driver data
   - If empty, backend isn't finding the field

### If Cars Still Appear Offline:

1. **Check unit timestamps:**
   - Look at `rawData.dt_tracker` in console
   - Convert to date: `new Date(timestamp * 1000)`
   - If > 24 hours old, unit is correctly marked offline

2. **Check Mapon unit status:**
   - Login to Mapon dashboard
   - Verify units are actively reporting
   - Check last update time

3. **Check network connectivity:**
   - Verify Mapon API is accessible
   - Check for timeout errors in backend logs

## Configuration

### Change Offline Threshold

Currently set to 24 hours. To change:

**File:** `backend/src/routes/mapon.ts`, Line 199

```typescript
// Current: 24 hours (86400 seconds)
if (timeDiff > 86400) {
    return 'offline';
}

// Change to 1 hour:
if (timeDiff > 3600) {
    return 'offline';
}

// Change to 5 minutes:
if (timeDiff > 300) {
    return 'offline';
}
```

After changing, rebuild and redeploy:
```bash
cd backend
npm run build
git commit -am "Adjust offline threshold"
git push
```

## Summary of Files Changed

1. **`backend/src/routes/mapon.ts`**
   - Added `plateNumber` extraction and transformation
   - Added comprehensive logging
   - Enhanced error handling

2. **`app.js`**
   - Updated vehicle dropdown to show license plates
   - Updated driver list to show license plates
   - Updated GPS markers to show license plates
   - Enhanced console logging

3. **`backend/package-lock.json`**
   - Automatically updated during npm install
   - No manual changes needed

## Deployment

Changes are ready for deployment:

1. **Heroku:**
   ```bash
   git push heroku main
   ```

2. **Or via GitHub:**
   - Merge PR to main branch
   - Heroku auto-deploys if connected to GitHub

No new environment variables needed. No database migrations required.

---

**Date:** 2025-11-13  
**Version:** 1.0  
**Status:** ✅ Ready for Production
