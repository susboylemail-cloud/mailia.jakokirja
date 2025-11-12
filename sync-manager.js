/**
 * Mailia Sync Manager
 * Handles offline sync queue with smart retry and exponential backoff
 */

class MailiaSyncManager {
    constructor() {
        this.isSyncing = false;
        this.syncListeners = [];
        this.maxRetries = 5;
        this.baseDelay = 1000; // 1 second
        this.maxDelay = 300000; // 5 minutes
    }

    /**
     * Initialize sync manager
     */
    async init() {
        console.log('🔄 Sync Manager initialized');
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.onOnline());
        window.addEventListener('offline', () => this.onOffline());

        // Try to sync on page load if online
        if (navigator.onLine) {
            await this.syncAll();
        }

        // Periodic sync check (every 2 minutes)
        setInterval(() => {
            if (navigator.onLine && !this.isSyncing) {
                this.syncAll();
            }
        }, 120000);
    }

    /**
     * Handle coming back online
     */
    async onOnline() {
        console.log('📡 Network restored - starting sync...');
        this.notifyListeners('online');
        await this.syncAll();
    }

    /**
     * Handle going offline
     */
    onOffline() {
        console.log('📴 Network lost - entering offline mode');
        this.notifyListeners('offline');
    }

    /**
     * Add sync status listener
     */
    addListener(callback) {
        this.syncListeners.push(callback);
    }

    /**
     * Notify all listeners
     */
    notifyListeners(event, data = {}) {
        this.syncListeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (error) {
                console.error('Listener error:', error);
            }
        });
    }

    /**
     * Sync all pending items
     */
    async syncAll() {
        if (this.isSyncing) {
            console.log('Sync already in progress, skipping...');
            return;
        }

        if (!navigator.onLine) {
            console.log('Offline - cannot sync');
            return;
        }

        this.isSyncing = true;
        this.notifyListeners('sync:start');

        try {
            const pendingItems = await window.mailiaOfflineDB.getPendingSyncItems();
            console.log(`🔄 Syncing ${pendingItems.length} pending items`);

            const results = {
                success: 0,
                failed: 0,
                conflicts: 0
            };

            for (const item of pendingItems) {
                // Check if max retries exceeded
                if (item.retryCount >= this.maxRetries) {
                    console.error(`❌ Max retries exceeded for item ${item.id}`);
                    await window.mailiaOfflineDB.updateSyncItemStatus(item.id, 'failed', 'Max retries exceeded');
                    results.failed++;
                    continue;
                }

                // Calculate backoff delay
                if (item.retryCount > 0) {
                    const delay = this.calculateBackoff(item.retryCount);
                    const timeSinceLastAttempt = Date.now() - new Date(item.lastAttempt).getTime();
                    
                    if (timeSinceLastAttempt < delay) {
                        console.log(`⏳ Waiting for backoff: ${item.id}`);
                        continue;
                    }
                }

                try {
                    await this.syncItem(item);
                    await window.mailiaOfflineDB.removeSyncItem(item.id);
                    results.success++;
                } catch (error) {
                    console.error(`Failed to sync item ${item.id}:`, error);
                    
                    if (error.isConflict) {
                        results.conflicts++;
                    } else {
                        await window.mailiaOfflineDB.updateSyncItemStatus(item.id, 'failed', error.message);
                        results.failed++;
                    }
                }
            }

            console.log('✅ Sync complete:', results);
            this.notifyListeners('sync:complete', results);
        } catch (error) {
            console.error('Sync error:', error);
            this.notifyListeners('sync:error', { error });
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Sync individual item
     */
    async syncItem(item) {
        console.log(`Syncing ${item.entityType} ${item.action}:`, item.id);

        switch (item.entityType) {
            case 'delivery':
                return await this.syncDelivery(item);
            case 'message':
                return await this.syncMessage(item);
            case 'route':
                return await this.syncRoute(item);
            default:
                throw new Error(`Unknown entity type: ${item.entityType}`);
        }
    }

    /**
     * Sync delivery update
     */
    async syncDelivery(item) {
        const { routeId, subscriberId, isDelivered } = item.data;

        // Check for conflicts
        if (window.mailiaAPI && window.mailiaAPI.isAuthenticated()) {
            try {
                // Get current server state
                const serverDeliveries = await window.mailiaAPI.getRouteDeliveries(routeId);
                const serverDelivery = serverDeliveries.find(d => d.subscriber_id === subscriberId);

                if (serverDelivery) {
                    const serverModified = new Date(serverDelivery.updated_at);
                    const localModified = new Date(item.timestamp);

                    // Check if server version is newer (conflict)
                    if (serverModified > localModified && serverDelivery.is_delivered !== isDelivered) {
                        console.warn('⚠️ Delivery conflict detected');
                        
                        await window.mailiaOfflineDB.addConflict(
                            'delivery',
                            { routeId, subscriberId, isDelivered, timestamp: item.timestamp },
                            { ...serverDelivery },
                            `${routeId}_${subscriberId}`
                        );

                        const error = new Error('Conflict detected');
                        error.isConflict = true;
                        throw error;
                    }
                }

                // No conflict, proceed with update
                await window.mailiaAPI.updateDelivery(routeId, subscriberId, isDelivered);
                console.log('✅ Delivery synced');
            } catch (error) {
                if (!error.isConflict) {
                    console.error('Failed to sync delivery:', error);
                }
                throw error;
            }
        } else {
            throw new Error('Not authenticated');
        }
    }

    /**
     * Sync message
     */
    async syncMessage(item) {
        const { routeId, messageType, message, photoFile } = item.data;

        if (window.mailiaAPI && window.mailiaAPI.isAuthenticated()) {
            try {
                await window.mailiaAPI.sendMessage(routeId, messageType, message);
                console.log('✅ Message synced');
            } catch (error) {
                console.error('Failed to sync message:', error);
                throw error;
            }
        } else {
            throw new Error('Not authenticated');
        }
    }

    /**
     * Sync route status
     */
    async syncRoute(item) {
        const { circuitId, action, routeId } = item.data;

        if (window.mailiaAPI && window.mailiaAPI.isAuthenticated()) {
            try {
                if (action === 'start') {
                    await window.mailiaAPI.startRoute(circuitId);
                } else if (action === 'complete') {
                    await window.mailiaAPI.completeRoute(routeId);
                }
                console.log('✅ Route synced');
            } catch (error) {
                console.error('Failed to sync route:', error);
                throw error;
            }
        } else {
            throw new Error('Not authenticated');
        }
    }

    /**
     * Calculate exponential backoff delay
     */
    calculateBackoff(retryCount) {
        // Exponential backoff: delay = baseDelay * 2^retryCount
        const delay = Math.min(
            this.baseDelay * Math.pow(2, retryCount),
            this.maxDelay
        );
        
        // Add jitter (±20%)
        const jitter = delay * 0.2 * (Math.random() - 0.5);
        return Math.floor(delay + jitter);
    }

    /**
     * Get sync queue status
     */
    async getStatus() {
        const pendingItems = await window.mailiaOfflineDB.getPendingSyncItems();
        const conflicts = await window.mailiaOfflineDB.getUnresolvedConflicts();

        return {
            pending: pendingItems.length,
            conflicts: conflicts.length,
            isSyncing: this.isSyncing,
            isOnline: navigator.onLine
        };
    }

    /**
     * Force sync now
     */
    async forceSyncNow() {
        console.log('🔄 Force sync requested');
        this.isSyncing = false; // Reset flag
        await this.syncAll();
    }
}

// Create global instance
window.mailiaSyncManager = new MailiaSyncManager();
