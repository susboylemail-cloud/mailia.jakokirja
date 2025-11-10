# Google Maps Integration Setup

## How to Add Your API Key

### Step 1: Edit index.html

Open `index.html` and find this line (around line 361):

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY_HERE&libraries=places" async defer></script>
```

Replace `YOUR_API_KEY_HERE` with your actual Google Maps API key:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX&libraries=places" async defer></script>
```

### Step 2: Required Google Maps APIs

Make sure these APIs are enabled in your Google Cloud Console:
1. **Maps JavaScript API** - For displaying maps
2. **Geocoding API** - For converting addresses to coordinates
3. **Directions API** - For route optimization (optional but recommended)
4. **Places API** - For address autocomplete

### Step 3: API Usage & Costs

**Free Tier:**
- $200 monthly credit
- ~28,000 map loads per month free
- ~40,000 geocoding requests per month free

**What the integration does:**
1. Geocodes all delivery addresses in the selected circuit
2. Displays them as numbered markers on the map
3. Shows delivery info when clicking markers
4. Optimizes delivery route (up to 25 stops)
5. Calculates total distance and time

## Features

### Map View Button
- Available in the 3-dot menu (⋮) for each circuit
- Click "🗺️ Näytä kartalla" to open map view

### Map Features
- **Numbered Markers**: Each delivery point is numbered in delivery order
- **Info Windows**: Click markers to see:
  - Address
  - Customer name
  - Products to deliver
  - Link to open in Google Maps app for navigation
  
- **Route Optimization**: Click "🧭 Optimoi reitti" to:
  - Calculate optimal driving route
  - Show turn-by-turn directions
  - Display total distance and time
  
### Address Format
Addresses are geocoded with format: `{address}, Imatra, Finland`

Example: `UITSOLANTIE 60, Imatra, Finland`

## Testing Locally

1. Add your API key to `index.html`
2. Start local server: `python -m http.server 5500`
3. Open http://localhost:5500
4. Login as admin
5. Select any circuit
6. Click the 3-dot menu (⋮)
7. Click "🗺️ Näytä kartalla"

## Deployment to Heroku

The map feature will work automatically on Heroku once you:
1. Add your API key to `index.html`
2. Commit and push changes:

```bash
git add index.html app.js
git commit -m "Add Google Maps integration"
git push origin main
git push heroku main
```

## Troubleshooting

### "Google Maps ladataan..." appears indefinitely
- Check that your API key is valid
- Ensure Maps JavaScript API is enabled
- Check browser console for errors

### Addresses not showing on map
- Check that Geocoding API is enabled
- Verify addresses are in correct format
- Some addresses may not be found by Google

### Route optimization fails
- Ensure Directions API is enabled
- Maximum 25 waypoints (Google limitation)
- Check API quota in Google Cloud Console

## Security Note

**For Production:**
Consider restricting your API key to:
- Your Heroku domain (mailia-imatra-XXXXX.herokuapp.com)
- HTTP referrers only
- Specific APIs only

This prevents unauthorized use and protects your API quota.
