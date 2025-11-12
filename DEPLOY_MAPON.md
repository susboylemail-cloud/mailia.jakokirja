# 🚀 Mapon GPS API Integration - DEPLOYMENT GUIDE

## ✅ What's Been Done

1. **Backend Implementation** ✅
   - Created `/backend/src/routes/mapon.ts` with 3 API endpoints
   - Registered routes in `server.ts`
   - Added axios dependency to `package.json`

2. **Frontend Integration** ✅
   - Updated `app.js` to call real API endpoints
   - Fixed token retrieval from sessionStorage
   - Added environment-aware API URL detection
   - Removed mock data function

3. **Configuration** ✅
   - Created `backend/.env` with MAPON_API_KEY
   - Updated `backend/.env.production` with API key
   - Added Heroku deployment scripts

4. **Documentation** ✅
   - `MAPON_INTEGRATION.md` - Technical documentation
   - `backend/MAPON_ACTIVATION.md` - Activation guide
   - This deployment guide

5. **Code Pushed** ✅
   - Commit: `930d009` - Activation changes
   - Commit: `50fe9e1` - Initial implementation
   - All changes on `main` branch

---

## 🎯 DEPLOYMENT TO HEROKU

### Option 1: Deploy via Web Dashboard (Easiest)

1. **Set Environment Variable**
   - Go to: https://dashboard.heroku.com/apps/YOUR_APP_NAME/settings
   - Click "Reveal Config Vars"
   - Add new variable:
     ```
     Key: MAPON_API_KEY
     Value: b6a5ce738b76b134d06e8b072a754918019a9ed7
     ```
   - Click "Add"

2. **Deploy from GitHub**
   - Go to "Deploy" tab
   - If not connected to GitHub:
     - Click "Connect to GitHub"
     - Search for repository: `mailia.jakokirja`
     - Click "Connect"
   - Scroll to "Manual deploy"
   - Select branch: `main`
   - Click "Deploy Branch"

3. **Wait for Build**
   - Heroku will automatically:
     - Install axios (from package.json)
     - Build TypeScript
     - Run database migrations
     - Start the server

4. **Verify**
   - Check build logs for any errors
   - Visit your app URL
   - Login as admin
   - Go to "Seuranta" tab
   - Click "Aloita seuranta"
   - GPS tracking should show real driver locations!

### Option 2: Deploy via Git (If you have Heroku CLI)

```bash
# Set the API key
heroku config:set MAPON_API_KEY=b6a5ce738b76b134d06e8b072a754918019a9ed7

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

### Option 3: Use PowerShell Script (Windows)

```powershell
# Navigate to project directory
cd c:\Users\OscarAlanne\Documents\jakokirja\mailia.jakokirja

# Run the automated script
.\scripts\heroku-set-mapon.ps1
```

---

## 🧪 TESTING AFTER DEPLOYMENT

### 1. Check Backend API

Open browser console and run:
```javascript
// Get your auth token first (it's in sessionStorage)
const token = sessionStorage.getItem('mailiaAuthToken');

// Test Mapon endpoint
fetch('/api/mapon/locations', {
    headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(console.log);
```

Expected response:
```json
{
  "success": true,
  "locations": [
    {
      "id": 123,
      "name": "Driver name",
      "circuit": "KP3",
      "lat": 61.1750,
      "lon": 28.7600,
      "speed": 25,
      "status": "moving",
      ...
    }
  ]
}
```

### 2. Check GPS Tracking UI

1. Login as admin user
2. Navigate to "Seuranta" tab
3. Click "Aloita seuranta" button
4. **Expected behavior:**
   - Leaflet map loads
   - Driver markers appear (if units exist in Mapon)
   - Driver cards show below map
   - Updates every 30 seconds

### 3. Check Browser Console

Look for:
```
GPS tracking initialized
Fetching driver locations...
GPS markers updated: X drivers
```

### 4. Check Heroku Logs

```bash
heroku logs --tail --source app
```

Look for:
```
GET /api/mapon/locations 200
Mapon API called successfully
```

---

## 🔧 TROUBLESHOOTING

### No Drivers Appearing

**Check 1: API Key Valid?**
```bash
# Test Mapon API directly
curl "https://mapon.com/api/v1/unit/list.json?key=b6a5ce738b76b134d06e8b072a754918019a9ed7"
```

**Check 2: Units Exist in Mapon?**
- Login to Mapon dashboard
- Verify you have active units
- Check units have recent GPS data

**Check 3: Backend Logs**
```bash
heroku logs --tail
```
Look for errors like:
- `Invalid API key`
- `Timeout error`
- `Network error`

**Check 4: Environment Variable Set?**
```bash
heroku config | grep MAPON
```
Should show:
```
MAPON_API_KEY: b6a5ce738b76b134d06e8b072a754918019a9ed7
```

### "Ei todennusta" Error

**Problem:** Token not found

**Solution:** Make sure you're logged in:
1. Logout (if logged in)
2. Login again as admin
3. Go to Seuranta tab
4. Try GPS tracking again

### Map Not Loading

**Check 1: Leaflet CDN accessible?**
Open browser DevTools → Network tab
Look for:
- `leaflet.js` (should be 200 OK)
- `leaflet.css` (should be 200 OK)

**Check 2: JavaScript errors?**
Open browser DevTools → Console
Look for any red errors

### Backend Error: "Cannot find module 'axios'"

**Problem:** Dependencies not installed

**Solution:**
```bash
# SSH into Heroku dyno
heroku run bash

# Install dependencies manually
npm install

# Or trigger rebuild
heroku restart
```

---

## 📊 MONITORING

### Check API Usage

```bash
# Count Mapon API calls in logs (last 1000 lines)
heroku logs -n 1000 | grep "mapon/locations" | wc -l
```

### Check Performance

```bash
# View response times
heroku logs --tail | grep "GET /api/mapon"
```

Expected: `< 1000ms` response time

### Set Up Alerts

If using Heroku metrics:
1. Go to app dashboard
2. Click "Metrics" tab
3. Set up alerts for:
   - High error rate (> 5%)
   - Slow response time (> 2000ms)
   - Dyno memory usage (> 80%)

---

## 🎨 CONFIGURING UNIT NAMES IN MAPON

For automatic circuit assignment, configure unit names in Mapon dashboard:

**Recommended naming format:**
```
Jakelija [Number] - [Circuit]
```

**Examples:**
- `Jakelija 1 - KP3` → Circuit: KP3 ✅
- `Jakelija 2 - KP10` → Circuit: KP10 ✅
- `Unit KPR1` → Circuit: KPR1 ✅
- `Driver 5` → Circuit: N/A ⚠️

**Supported circuit patterns:**
- `KP3`, `KP10`, `KP32A`, `KP55B`
- `KPR1`, `KPR5`, `KPR6`
- `K28`

---

## ⚙️ CONFIGURATION OPTIONS

### Change Polling Interval

**File:** `app.js`
**Line:** ~8598

```javascript
// Default: 30 seconds
const GPS_UPDATE_INTERVAL = 30000;

// Change to 1 minute (reduce API calls)
const GPS_UPDATE_INTERVAL = 60000;

// Change to 15 seconds (more real-time)
const GPS_UPDATE_INTERVAL = 15000;
```

After changing, commit and redeploy.

### Change API Timeout

**File:** `backend/src/routes/mapon.ts`
**Line:** ~22

```typescript
timeout: 10000 // 10 seconds (default)

// Increase for slow connections
timeout: 30000 // 30 seconds
```

---

## 📈 NEXT STEPS

### 1. Test with Real Vehicles
- Configure GPS devices in vehicles
- Ensure they're reporting to Mapon
- Verify locations appear in app

### 2. User Training
- Train admin users on GPS features
- Document any issues
- Gather feedback

### 3. Optimization (if needed)
- Adjust polling interval based on usage
- Add caching if API limits are hit
- Consider WebSocket for real-time updates

### 4. Monitoring
- Set up alerts for API failures
- Monitor response times
- Track API usage vs Mapon limits

---

## 📝 DEPLOYMENT CHECKLIST

- [x] Code implemented and tested
- [x] Dependencies added to package.json
- [x] Environment variables configured
- [x] Code pushed to GitHub
- [ ] **MAPON_API_KEY set in Heroku config**
- [ ] **Deploy to Heroku**
- [ ] **Test GPS tracking in production**
- [ ] Configure unit names in Mapon
- [ ] Train users
- [ ] Monitor for 24 hours

---

## 🆘 NEED HELP?

**Quick Fixes:**
1. Check Heroku logs: `heroku logs --tail`
2. Restart dyno: `heroku restart`
3. Verify env var: `heroku config:get MAPON_API_KEY`
4. Check build: `heroku releases`

**Documentation:**
- Technical: `MAPON_INTEGRATION.md`
- Activation: `backend/MAPON_ACTIVATION.md`
- Mapon API: https://mapon.com/api/

**Status Page:**
- Heroku: https://status.heroku.com/
- Mapon: Check their support site

---

## ✅ SUMMARY

The Mapon GPS API integration is **READY FOR DEPLOYMENT**.

**What happens when you deploy:**
1. Heroku installs axios automatically (from package.json)
2. TypeScript compiles the new mapon.ts route
3. Server starts with MAPON_API_KEY from config
4. Frontend calls `/api/mapon/locations` endpoint
5. Backend proxies to Mapon API
6. Real driver locations appear on map!

**Final step:** Deploy to Heroku via dashboard or CLI

🎉 **Ready to go live!**
