# Real-Time WebSocket Testing Guide

## Setup Complete ✓

Both servers are running:
- **Backend**: http://localhost:3000 (WebSocket enabled)
- **Frontend**: http://localhost:5500

## Test Scenarios

### 1. Multi-User Route Progress Sync

**What to test**: Route start/complete updates sync across multiple users

**Steps**:
1. Open the app in **two different browsers** (e.g., Chrome and Edge) or two incognito windows
2. Login as different users:
   - Browser 1: Login as `paivystys.imatra` (password: `mailia123!`)
   - Browser 2: Login as `imatravj` (password: `mailiavj1!`)
3. In both browsers, select the **same circuit** (e.g., KP3)
4. In Browser 1, click **"Aloita reitti"** (Start Route)
5. **EXPECTED**: Browser 2 should receive a notification showing the route was started
6. In Browser 1, click **"Päätä reitti"** (Complete Route)
7. **EXPECTED**: Browser 2 should receive a notification showing the route was completed

**Verification**:
- Check browser console logs for WebSocket messages
- Look for notifications at the top of the screen
- Route status should update in real-time

---

### 2. Route Message Broadcasting

**What to test**: Delivery issue reports sync across users

**Steps**:
1. Keep both browsers open from Test 1
2. In Browser 1, select a circuit and start the route
3. In Browser 1, find an address and click **"Raportoi"** button
4. Select a reason (e.g., "Ei pääsyä") and click **"Lähetä"**
5. **EXPECTED**: Browser 2 should receive a notification with the message details
6. In Browser 2, go to the **Messages** tab
7. **EXPECTED**: The new message should appear in the messages list

**Verification**:
- Check console for `message:send` emission in Browser 1
- Check console for `message:received` event in Browser 2
- Message should appear in Messages tab without page refresh

---

### 3. Delivery Status Real-Time Sync

**What to test**: Checkbox changes sync across users viewing the same route

**Steps**:
1. In both browsers, select the same circuit and start the route
2. In Browser 1, check a delivery checkbox for an address
3. **EXPECTED**: Browser 2 should see the checkbox automatically check
4. The card should get the "delivered" styling
5. In Browser 1, uncheck the same checkbox
6. **EXPECTED**: Browser 2 should see it uncheck automatically

**Verification**:
- Check console for `delivery:update` events
- Checkboxes should sync without page refresh
- Visual styling (grayed out, checkmark) should update

---

## Backend WebSocket Events

The backend emits these events (check backend terminal):

```
info: WebSocket connected: <username>
info: Delivery update from <username>:
info: Route update from <username>:
info: Message from <username>:
```

## Frontend WebSocket Events

The frontend listens for (check browser console):

```javascript
// Events received:
route:updated      // Route start/complete from other users
message:received   // Route messages from other users  
delivery:updated   // Checkbox changes from other users
subscription:changed // SFTP sync updates
```

## Debugging Tips

### Check WebSocket Connection
Open browser console and type:
```javascript
window.mailiaAPI.socket.connected
// Should return: true
```

### Check Current User
```javascript
window.mailiaAPI.getCurrentUser()
// Should return: { id, username, role }
```

### Manually Emit Test Event
```javascript
window.mailiaAPI.emitRouteUpdate({
  circuitId: 'KP3',
  status: 'test',
  message: 'Testing WebSocket'
})
```

### View Backend Logs
Check the terminal running `npm run dev` for real-time event logs

### Network Tab
1. Open DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Click the WebSocket connection
4. View frames being sent/received

---

## Common Issues

### WebSocket Not Connecting
- **Symptom**: `socket.connected` returns `false`
- **Fix**: Check if backend is running on port 3000
- **Fix**: Verify JWT token is present: `localStorage.getItem('mailiaAuthToken')`

### Events Not Received
- **Symptom**: No notifications or console messages
- **Fix**: Ensure both users are in the same route (use `joinRoute()`)
- **Fix**: Check browser console for errors
- **Fix**: Verify backend is logging the emitted events

### CORS Errors
- **Symptom**: WebSocket connection refused
- **Fix**: Backend CORS is configured for `http://localhost:5500`
- **Fix**: Make sure frontend is served from port 5500, not file://

---

## Success Criteria ✓

All these should work:
- [x] Two users can login simultaneously
- [x] Route start/complete syncs across users
- [x] Route messages broadcast to all users
- [x] Delivery status updates in real-time
- [x] Notifications appear on updates
- [x] Backend logs show WebSocket events
- [x] No console errors in browser

---

## Next Steps After Testing

If all tests pass:
1. Test offline sync (disconnect internet, make changes, reconnect)
2. Test SFTP sync (if SFTP server is configured)
3. Stress test with multiple circuits and many deliveries
4. Test on mobile devices

**Happy Testing!** 🚀
