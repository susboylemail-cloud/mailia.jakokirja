# Quick Real-Time Testing Reference 🚀

## ✅ Setup Complete

- ✅ Backend running: http://localhost:3000
- ✅ Frontend running: http://localhost:5500
- ✅ WebSocket real-time sync enabled
- ✅ Browser opened

## 🧪 Quick Test (2 minutes)

### Step 1: Open Two Browsers
- **Browser 1**: Already open at http://localhost:5500
- **Browser 2**: Open http://localhost:5500 in a different browser (Edge/Firefox) or incognito window

### Step 2: Login
- **Browser 1**: Login as `paivystys.imatra` / `mailia123!`
- **Browser 2**: Login as `imatravj` / `mailiavj1!`

### Step 3: Test Route Sync
1. Both browsers → Select **KP3** circuit
2. Browser 1 → Click **"Aloita reitti"**
3. **Look at Browser 2** → Should see notification: "Reitin tila päivitetty käyttäjältä: paivystys.imatra"
4. Browser 1 → Click **"Päätä reitti"**
5. **Look at Browser 2** → Should see notification about route completion

### Step 4: Test Message Broadcast
1. Browser 1 → Click **"Raportoi"** on any address
2. Select reason "Ei pääsyä" → Click "Lähetä"
3. **Look at Browser 2** → Should see notification with message
4. Browser 2 → Go to **Messages** tab → Message should appear

### Step 5: Test Delivery Sync
1. Both browsers → Make sure route is started
2. Browser 1 → Check any delivery checkbox
3. **Look at Browser 2** → Checkbox should check automatically
4. Browser 1 → Uncheck the checkbox
5. **Look at Browser 2** → Checkbox should uncheck automatically

## 🔍 Verify Success

Open browser console (F12) in both browsers. You should see:
```
WebSocket connected
Route updated event received: ...
Message received event: ...
Delivery updated event received: ...
```

## 🎯 What You're Testing

1. **Route Progress Sync**: When one user starts/completes a route, others see it in real-time
2. **Route Messages**: When one user reports a delivery issue, others get notified
3. **Delivery Status**: When one user checks/unchecks deliveries, it syncs to others

## 📝 Users Available

| Username | Password | Role |
|----------|----------|------|
| paivystys.imatra | mailia123! | admin |
| imatravj | mailiavj1! | driver |

## 🐛 Debug Console Commands

```javascript
// Check WebSocket connection
window.mailiaAPI.socket.connected  // Should be true

// Check current user
window.mailiaAPI.getCurrentUser()

// Check if in route room
window.mailiaAPI.socket.rooms  // Should show route rooms
```

## ✨ Expected Behavior

- ✅ Notifications appear at top of screen
- ✅ Updates happen without page refresh
- ✅ Backend terminal shows WebSocket events
- ✅ Browser console shows event logs
- ✅ Multiple users can work simultaneously

**Ready to test!** Open your second browser and follow the steps above. 🎉
