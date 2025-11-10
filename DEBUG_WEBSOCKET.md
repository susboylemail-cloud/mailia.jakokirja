# WebSocket Debugging Guide

## Quick Check - Is WebSocket Connected?

### In Browser Console (F12):
```javascript
// Check if WebSocket is connected
window.mailiaAPI.socket.connected
// Should return: true

// Check current user
window.mailiaAPI.getCurrentUser()
// Should return: { id: 1, username: "...", role: "..." }
```

## Test WebSocket Events

### 1. Listen for ALL WebSocket events
Paste this in browser console to see all incoming WebSocket events:

```javascript
// Listen to all socket events
const originalOn = window.mailiaAPI.socket.on.bind(window.mailiaAPI.socket);
window.mailiaAPI.socket.on = function(event, handler) {
    console.log('🎧 Listening for event:', event);
    return originalOn(event, function(...args) {
        console.log('📨 Received event:', event, args);
        return handler.apply(this, args);
    });
};

// Also log emitted events
const originalEmit = window.mailiaAPI.socket.emit.bind(window.mailiaAPI.socket);
window.mailiaAPI.socket.emit = function(event, ...args) {
    console.log('📤 Emitting event:', event, args);
    return originalEmit(event, ...args);
};
```

### 2. Manually Test Event Reception

In **Browser 1** console:
```javascript
// Emit a test route update
window.mailiaAPI.emitRouteUpdate({
    circuitId: 'KP3',
    routeId: 999,
    status: 'TEST',
    message: 'This is a test from Browser 1'
});
```

In **Browser 2** console, you should see:
```
📨 Received event: route:updated [{circuitId: "KP3", ...}]
Route updated event received: ...
```

### 3. Check Event Listeners

Make sure event listeners are registered:
```javascript
// Check if custom events are dispatched
window.addEventListener('routeUpdated', (e) => {
    console.log('✅ routeUpdated custom event fired!', e.detail);
});

window.addEventListener('messageReceived', (e) => {
    console.log('✅ messageReceived custom event fired!', e.detail);
});

window.addEventListener('deliveryUpdated', (e) => {
    console.log('✅ deliveryUpdated custom event fired!', e.detail);
});
```

## Common Issues

### Issue 1: `window.mailiaAPI.socket.connected` returns `false`

**Fix:**
```javascript
// Reconnect manually
window.mailiaAPI.connectWebSocket();
```

### Issue 2: No events received

**Check 1 - Socket.IO is loaded:**
```javascript
typeof io !== 'undefined'
// Should return: true
```

**Check 2 - Token exists:**
```javascript
localStorage.getItem('mailiaAuthToken')
// Should return: a long JWT string
```

**Check 3 - Socket has listeners:**
```javascript
Object.keys(window.mailiaAPI.socket._callbacks || {})
// Should show: $route:updated, $message:received, etc.
```

### Issue 3: Events sent but not received

**Backend Check:**
Look in backend terminal for:
```
info: Broadcasted route:updated to all clients
info: Broadcasted message:received to all clients
info: Broadcasted delivery:updated to route:5
```

If you DON'T see "Broadcasted" logs, the events aren't being sent.

**Frontend Check:**
Open Network tab → Filter by "WS" → Click the WebSocket connection → Go to "Messages" tab
You should see frames like:
```
42["route:updated",{"circuitId":"KP3",...}]
```

## Testing Step-by-Step

### Test 1: Route Start Sync

1. **Browser 1**: Open console, run:
```javascript
console.log('Test: Starting route...');
```

2. **Browser 1**: Click "Aloita reitti" button

3. **Browser 2**: Should see in console:
```
Route updated event received: {circuitId: "KP3", status: "started", ...}
```

4. **Browser 2**: Should see notification at top of screen

### Test 2: Message Broadcast

1. **Browser 1**: Click "Raportoi" on any address

2. **Browser 1**: Select reason and click "Lähetä"

3. **Browser 2**: Should see in console:
```
Message received event: {message: "...", username: "...", ...}
```

4. **Browser 2**: Should see notification

### Test 3: Checkbox Sync

1. **Both browsers**: Select KP3 circuit and start route

2. **Browser 1**: Check a delivery checkbox

3. **Browser 2**: Should see in console:
```
Delivery updated event received: {subscriberId: 123, isDelivered: true, ...}
```

4. **Browser 2**: Checkbox should check automatically

## Force Reload

If nothing works, do a **hard refresh**:
- Chrome: `Ctrl + Shift + R` or `Ctrl + F5`
- Edge: `Ctrl + F5`

This clears cached JavaScript files.

## Still Not Working?

Check these in order:

1. ✅ Backend running on port 3000
2. ✅ Frontend running on port 5500  
3. ✅ No console errors (red text)
4. ✅ WebSocket connected (`window.mailiaAPI.socket.connected === true`)
5. ✅ Both users logged in
6. ✅ Backend shows "Broadcasted" logs when you perform actions

**Share the output of these commands:**
```javascript
// In browser console:
{
    connected: window.mailiaAPI.socket.connected,
    user: window.mailiaAPI.getCurrentUser(),
    token: !!localStorage.getItem('mailiaAuthToken'),
    socketIO: typeof io !== 'undefined'
}
```
