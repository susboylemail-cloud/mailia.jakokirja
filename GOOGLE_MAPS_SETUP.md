# Google Maps Integration Setup

## Quick Start - Add Your API Key

### Step 1: Edit index.html

Open `index.html` and find line 361:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY_HERE&libraries=places" async defer></script>
```

Replace `YOUR_API_KEY_HERE` with your actual Google Maps API key:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX&libraries=places" async defer></script>
```

### Step 2: Deploy

Commit and deploy to Heroku:

```bash
git add index.html
git commit -m "Add Google Maps API key"
git push origin main
git push heroku main
```

That's it! The map feature will work immediately.

---

## Features Overview

### Where to Find Map View

**For All Users:**
- Open any circuit (e.g., KP2)
- Map button appears prominently at the top of the cover page
- Click "🗺️ Näytä kartalla" button

**For Admin/Manager:**
- Also available in 3-dot menu (⋮) on circuit list

### Map Features
- **Numbered Markers**: Each delivery point numbered in sequence
- **Info Windows**: Click markers to see:
  - Address
  - Customer name
  - Products to deliver
  - Link to open in Google Maps app for navigation
  
- **Route Optimization**: Click "🧭 Optimoi reitti" to:
  - Calculate optimal driving route
  - Show turn-by-turn directions
  - Display total distance and estimated time
  
### Address Format
Addresses are geocoded as: `{address}, Imatra, Finland`

Example: `UITSOLANTIE 60, Imatra, Finland`

---

## Required Google Maps APIs

Make sure these APIs are enabled in your Google Cloud Console:
1. **Maps JavaScript API** - For displaying maps
2. **Geocoding API** - For converting addresses to coordinates
3. **Directions API** - For route optimization
4. **Places API** - For address autocomplete

### How to Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Go to "APIs & Services" > "Library"
4. Search for and enable each API listed above
5. Go to "Credentials" to get your API key

---

## API Usage & Costs

**Free Tier:**
- $200 monthly credit (enough for most small businesses)
- ~28,000 map loads per month
- ~40,000 geocoding requests per month
- ~10,000 directions requests per month

**What Uses API Calls:**
- Opening map view: 1 map load
- Each address geocoded: 1 geocoding call
- Route optimization: 1 directions call

**Example for 50 circuits with 50 addresses each:**
- Total addresses: 2,500
- If viewed once per day: ~2,500 geocoding calls/day
- Within free tier: ✅ Yes (1,290 calls/day average)

---

## Testing Locally

1. Add your API key to `index.html`
2. Start Python server: `python -m http.server 5500`
3. Open http://localhost:5500
4. Login and select a circuit
5. Click "🗺️ Näytä kartalla"

---

## Troubleshooting

### "Google Maps ladataan..." never finishes
- **Solution**: Check that your API key is correct
- Verify Maps JavaScript API is enabled
- Check browser console for errors (F12)

### Map shows but addresses don't appear
- **Solution**: Enable Geocoding API
- Check that addresses are in correct format
- Some addresses may not be recognized by Google

### Route optimization button doesn't work
- **Solution**: Enable Directions API
- Limited to 25 waypoints maximum
- Check API quota in Google Cloud Console

### "This page can't load Google Maps correctly"
- **Solution**: Your API key may need billing enabled
- Even with free tier, you must add a payment method
- You won't be charged if you stay under $200/month

---

## Security Recommendations

**For Production:**

1. **Restrict API Key** in Google Cloud Console:
   - Application restrictions: HTTP referrers
   - Website restrictions: Add your domains:
     - `mailia-imatra-*.herokuapp.com/*`
     - `localhost:5500/*` (for testing)
   
2. **API Restrictions**:
   - Restrict key to only these APIs:
     - Maps JavaScript API
     - Geocoding API
     - Directions API
     - Places API
   
3. **Set Quotas** (optional):
   - Limit requests per day
   - Get alerts before hitting limits
   - Prevent unexpected charges

### Why Restrict?

- Prevents unauthorized use if key is exposed
- Protects your API quota
- Avoids unexpected charges
- Reduces security risks

---

## Advanced Features (Future)

Possible enhancements:
- Save optimized routes
- Real-time traffic data
- Multi-stop route planning
- Delivery time estimates
- Customer location clustering
- Offline map caching

---

## Support

If you encounter issues:
1. Check browser console (F12) for errors
2. Verify all APIs are enabled
3. Confirm API key has no restrictions blocking localhost or Heroku
4. Check Google Cloud Console quotas

For Google Maps API help:
- [Official Documentation](https://developers.google.com/maps/documentation)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)
