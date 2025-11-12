# Offline Mode Implementation

## Overview

The Mailia delivery tracking system now includes comprehensive offline mode support with background sync, conflict resolution, and smart retry logic. This allows drivers to continue working even when internet connectivity is unreliable or unavailable.

## Architecture

### Components

1. **IndexedDB Storage** (`offline-db.js`)
   - Persistent client-side database for offline data
   - 5 object stores for different data types
   - Automatic initialization and migration support

2. **Sync Manager** (`sync-manager.js`)
   - Orchestrates background synchronization
   - Intelligent retry with exponential backoff
   - Conflict detection and resolution
   - Periodic sync every 2 minutes when online

3. **Conflict Resolution UI** (`conflict-ui.js`)
   - Visual interface for resolving sync conflicts
   - Side-by-side comparison of local vs server data
   - User-friendly decision making process

4. **Offline Status Indicator** (integrated in `app.js`)
   - Real-time network status display
   - Pending sync items counter
   - Conflict alert badge
   - Visual feedback for sync operations

## Features

### 1. Background Sync Queue

When offline, all delivery updates are automatically queued:
- Checkbox state changes
- Route messages
- Route start/end times
- Delivery status updates

The queue is automatically processed when connectivity returns.

### 2. Smart Retry Logic

**Exponential Backoff:**
- Base delay: 1 second
- Max delay: 5 minutes
- Max retries: 5 attempts
- Jitter: ±20% randomization to prevent thundering herd

**Formula:**
```javascript
delay = min(baseDelay * 2^retryCount, maxDelay) * (1 ± 0.2)
```

**Example retry sequence:**
1. 1 second (±200ms)
2. 2 seconds (±400ms)
3. 4 seconds (±800ms)
4. 8 seconds (±1.6s)
5. 16 seconds (±3.2s)

After 5 failures, items remain in queue for manual retry or admin intervention.

### 3. Conflict Detection

Conflicts occur when:
- Local and server both modified the same delivery
- Timestamps differ significantly
- State mismatch (local=delivered, server=pending or vice versa)

The system detects conflicts by comparing:
- Delivery status
- Timestamps
- Route IDs

### 4. Conflict Resolution UI

When conflicts are detected, users see:
- **Notification banner** at top of screen
- **Resolve button** to open conflict modal
- **Side-by-side comparison**:
  - Left: Local changes
  - Right: Server version
- **Easy selection** - click to choose which version to keep
- **Automatic application** - chosen version syncs immediately

## User Interface

### Offline Status Indicator

Located in top-right corner, shows:
- **Green dot** 🟢 - Online and synced
- **Red dot** 🔴 - Offline (changes queued)
- **Yellow dot** 🟡 - Syncing in progress
- **Blue badge** - Number of pending sync items
- **Red badge** - Number of conflicts requiring attention

### Conflict Notification

When conflicts exist:
- Prominent red banner appears at top
- Shows conflict count
- "Resolve" button opens resolution modal
- "Ignore" button dismisses for now (conflicts remain)

### Conflict Resolution Modal

Features:
- Clean, modern design
- Side-by-side comparison
- Color-coded badges (local=yellow, server=blue)
- Delivery status with icons
- Timestamp display
- "Resolve" button (disabled until selection made)
- "Cancel" button to skip

## Data Flow

### Normal Operation (Online)

```
User Action
    ↓
Update UI
    ↓
Save to LocalStorage
    ↓
API Request to Backend
    ↓
WebSocket Broadcast
    ↓
Other Clients Update
```

### Offline Operation

```
User Action
    ↓
Update UI
    ↓
Save to LocalStorage
    ↓
Add to IndexedDB Sync Queue ← (API request fails)
    ↓
Show "Offline" indicator
    ↓
(Network returns)
    ↓
Sync Manager Processes Queue
    ↓
Retry with Exponential Backoff
    ↓
Success or Conflict Detection
```

### Conflict Resolution Flow

```
Sync Attempt
    ↓
Detect Conflict (local ≠ server)
    ↓
Save to Conflicts Store
    ↓
Show Notification Banner
    ↓
User Clicks "Resolve"
    ↓
Show Modal with Options
    ↓
User Selects Version
    ↓
Apply Selected Version
    ↓
Update Both Local & Server
    ↓
Remove from Conflicts Store
```

## IndexedDB Schema

### Object Stores

1. **syncQueue**
   - Primary Key: Auto-increment ID
   - Indexes: status, entity_type, timestamp
   - Fields: entity_type, action, data, retry_count, last_attempt, status

2. **offlineMessages**
   - Primary Key: ID (generated)
   - Fields: circuit_id, message, timestamp, synced

3. **deliveryCache**
   - Primary Key: subscriber_id
   - Indexes: circuit_id, is_delivered
   - Fields: route_id, is_delivered, cached_at

4. **conflicts**
   - Primary Key: Auto-increment ID
   - Indexes: entity_type, entity_id
   - Fields: entity_type, entity_id, local_data, server_data, detected_at

5. **circuitCache**
   - Primary Key: circuit_id
   - Fields: data, cached_at

## API Integration

### Sync Queue Item Structure

```javascript
{
    entity_type: 'delivery' | 'message' | 'route',
    action: 'create' | 'update' | 'delete',
    data: {
        // Delivery update
        routeId: number,
        subscriberId: number,
        isDelivered: boolean,
        circuitId: string,
        address: string
    },
    retry_count: number,
    last_attempt: Date,
    status: 'pending' | 'syncing' | 'failed' | 'completed'
}
```

### Conflict Structure

```javascript
{
    entity_type: 'delivery',
    entity_id: string, // Format: "routeId_subscriberId"
    local_data: {
        isDelivered: boolean,
        timestamp: Date
    },
    server_data: {
        isDelivered: boolean,
        timestamp: Date
    },
    detected_at: Date
}
```

## Configuration

### Sync Manager Settings

```javascript
// In sync-manager.js
const SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutes
const MAX_RETRIES = 5;
const BASE_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 10; // Process 10 items at a time
```

### Status Update Frequency

```javascript
// In app.js - setupOfflineStatusIndicator()
setInterval(updateStatus, 5000); // Update every 5 seconds
```

## Testing Offline Mode

### Manual Testing

1. **Go Offline:**
   - Open DevTools → Network tab
   - Select "Offline" from throttling dropdown
   - OR: Disconnect WiFi/Ethernet

2. **Perform Actions:**
   - Toggle delivery checkboxes
   - Send route messages
   - Start/end routes

3. **Verify Queue:**
   - Check IndexedDB in DevTools (Application tab)
   - Look for items in `syncQueue` store
   - Verify status indicator shows pending count

4. **Go Online:**
   - Re-enable network
   - Watch sync indicator turn yellow (syncing)
   - Verify items sync and counter decreases
   - Check for any conflicts

### Automated Testing

```javascript
// Test offline queue
await offlineDB.addToSyncQueue({
    entity_type: 'delivery',
    action: 'update',
    data: { routeId: 1, subscriberId: 1, isDelivered: true }
});

const pending = await offlineDB.getPendingSyncItems();
console.log('Pending items:', pending.length);

// Test sync
await syncManager.syncAll();

// Test conflict detection
await offlineDB.addConflict({
    entity_type: 'delivery',
    entity_id: '1_1',
    local_data: { isDelivered: true, timestamp: new Date() },
    server_data: { isDelivered: false, timestamp: new Date() }
});

const conflicts = await offlineDB.getAllConflicts();
console.log('Conflicts:', conflicts.length);
```

## Browser Compatibility

### IndexedDB Support
- ✅ Chrome/Edge 24+
- ✅ Firefox 16+
- ✅ Safari 10+
- ✅ Mobile browsers (iOS 10+, Android 4.4+)

### Storage Limits
- Desktop: ~50% of free disk space (per origin)
- Mobile: Varies by browser (5-50MB typical)
- Quota API available for checking limits

## Error Handling

### Network Errors
- Caught and logged
- Item remains in queue
- Retry with backoff

### Quota Exceeded
- Warning shown to user
- Oldest cached data cleared first
- Critical sync queue preserved

### Conflict Resolution Errors
- Modal shows error message
- Conflict remains in queue
- User can retry

## Performance Considerations

### Memory Usage
- IndexedDB data stored on disk, not in RAM
- Minimal memory footprint
- Efficient for large datasets

### Battery Impact
- Periodic sync uses minimal CPU
- Pauses when page not visible
- No sync when battery saver active (future enhancement)

### Network Usage
- Batch processing reduces requests
- Only syncs changed data
- Respects metered connections (future enhancement)

## Future Enhancements

1. **Service Worker Integration**
   - Background sync even when app closed
   - Push notifications for sync completion
   - Automatic retry on network restoration

2. **Advanced Conflict Resolution**
   - Auto-merge simple conflicts
   - Three-way merge for complex scenarios
   - Conflict history and audit trail

3. **Smart Sync**
   - Detect metered connections
   - Respect battery saver mode
   - Priority-based sync (critical data first)

4. **Offline Analytics**
   - Track offline usage patterns
   - Sync success/failure rates
   - Average time in offline mode

5. **Data Compression**
   - Compress large payloads before storing
   - Reduce IndexedDB storage usage
   - Faster sync over slow connections

## Troubleshooting

### Queue Not Syncing

1. Check network connectivity
2. Verify API authentication (JWT token valid)
3. Check browser console for errors
4. Inspect IndexedDB for stuck items
5. Clear and re-queue if necessary

### Conflicts Not Resolving

1. Verify conflict UI is initialized
2. Check conflict store in IndexedDB
3. Ensure modal is not blocked by other UI
4. Try manual resolution via DevTools

### Storage Quota Issues

1. Check quota usage: `navigator.storage.estimate()`
2. Clear old cached circuits
3. Remove completed sync queue items
4. Consider data retention policy

### High Retry Count

1. Check server logs for errors
2. Verify API endpoint availability
3. Inspect failed request details
4. Consider manual intervention for stuck items

## Developer Notes

### Adding New Sync Types

To add a new entity type to offline sync:

1. Update `offline-db.js` if new store needed
2. Add sync logic to `sync-manager.js`:
   ```javascript
   case 'new_entity':
       await api.newEntityMethod(item.data);
       break;
   ```
3. Add conflict detection logic
4. Update conflict UI template if needed

### Debugging

Enable verbose logging:
```javascript
// In browser console
localStorage.setItem('DEBUG_OFFLINE', 'true');
```

View all pending syncs:
```javascript
// In browser console
const db = new OfflineDB();
await db.init();
const pending = await db.getPendingSyncItems();
console.table(pending);
```

## Credits

Offline mode implementation follows modern PWA best practices:
- IndexedDB API standard
- Service Worker sync patterns
- Exponential backoff algorithm
- Optimistic UI updates
