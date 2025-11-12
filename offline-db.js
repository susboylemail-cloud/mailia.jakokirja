/**
 * Mailia Offline Database Module
 * IndexedDB wrapper for offline data storage and sync queue management
 */

class MailiaOfflineDB {
    constructor() {
        this.dbName = 'MailiaOfflineDB';
        this.version = 1;
        this.db = null;
    }

    /**
     * Initialize IndexedDB database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Sync queue store for offline actions
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    syncStore.createIndex('entityType', 'entityType', { unique: false });
                    syncStore.createIndex('status', 'status', { unique: false });
                    console.log('Created syncQueue store');
                }

                // Offline messages store
                if (!db.objectStoreNames.contains('offlineMessages')) {
                    const messagesStore = db.createObjectStore('offlineMessages', { keyPath: 'id', autoIncrement: true });
                    messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
                    messagesStore.createIndex('circuitId', 'circuitId', { unique: false });
                    console.log('Created offlineMessages store');
                }

                // Delivery cache store
                if (!db.objectStoreNames.contains('deliveryCache')) {
                    const deliveryStore = db.createObjectStore('deliveryCache', { keyPath: 'id' });
                    deliveryStore.createIndex('circuitId', 'circuitId', { unique: false });
                    deliveryStore.createIndex('subscriberId', 'subscriberId', { unique: false });
                    deliveryStore.createIndex('lastModified', 'lastModified', { unique: false });
                    console.log('Created deliveryCache store');
                }

                // Conflicts store
                if (!db.objectStoreNames.contains('conflicts')) {
                    const conflictsStore = db.createObjectStore('conflicts', { keyPath: 'id', autoIncrement: true });
                    conflictsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    conflictsStore.createIndex('entityType', 'entityType', { unique: false });
                    conflictsStore.createIndex('resolved', 'resolved', { unique: false });
                    console.log('Created conflicts store');
                }

                // Circuit data cache
                if (!db.objectStoreNames.contains('circuitCache')) {
                    const circuitStore = db.createObjectStore('circuitCache', { keyPath: 'circuitId' });
                    circuitStore.createIndex('lastFetched', 'lastFetched', { unique: false });
                    console.log('Created circuitCache store');
                }
            };
        });
    }

    /**
     * Add item to sync queue
     */
    async addToSyncQueue(entityType, action, data, retryCount = 0) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');

        const item = {
            entityType,
            action,
            data,
            timestamp: new Date().toISOString(),
            status: 'pending',
            retryCount,
            lastAttempt: null,
            error: null
        };

        return new Promise((resolve, reject) => {
            const request = store.add(item);
            request.onsuccess = () => {
                console.log('✅ Added to sync queue:', entityType, action);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all pending sync queue items
     */
    async getPendingSyncItems() {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['syncQueue'], 'readonly');
        const store = transaction.objectStore('syncQueue');
        const index = store.index('status');

        return new Promise((resolve, reject) => {
            const request = index.getAll('pending');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update sync queue item status
     */
    async updateSyncItemStatus(id, status, error = null) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');

        return new Promise((resolve, reject) => {
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    item.status = status;
                    item.lastAttempt = new Date().toISOString();
                    if (error) item.error = error;
                    if (status === 'failed') item.retryCount = (item.retryCount || 0) + 1;

                    const updateRequest = store.put(item);
                    updateRequest.onsuccess = () => resolve(item);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Item not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Remove sync queue item
     */
    async removeSyncItem(id) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Save delivery to offline cache
     */
    async saveDeliveryCache(routeId, subscriberId, isDelivered, circuitId) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['deliveryCache'], 'readwrite');
        const store = transaction.objectStore('deliveryCache');

        const delivery = {
            id: `${routeId}_${subscriberId}`,
            routeId,
            subscriberId,
            circuitId,
            isDelivered,
            lastModified: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const request = store.put(delivery);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get cached deliveries for a circuit
     */
    async getDeliveryCache(circuitId) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['deliveryCache'], 'readonly');
        const store = transaction.objectStore('deliveryCache');
        const index = store.index('circuitId');

        return new Promise((resolve, reject) => {
            const request = index.getAll(circuitId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Save message offline
     */
    async saveOfflineMessage(message, circuitId) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['offlineMessages'], 'readwrite');
        const store = transaction.objectStore('offlineMessages');

        const offlineMessage = {
            ...message,
            circuitId,
            timestamp: new Date().toISOString(),
            synced: false
        };

        return new Promise((resolve, reject) => {
            const request = store.add(offlineMessage);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all offline messages
     */
    async getOfflineMessages() {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['offlineMessages'], 'readonly');
        const store = transaction.objectStore('offlineMessages');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete offline message
     */
    async deleteOfflineMessage(id) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['offlineMessages'], 'readwrite');
        const store = transaction.objectStore('offlineMessages');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add conflict for resolution
     */
    async addConflict(entityType, localData, serverData, entityId) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['conflicts'], 'readwrite');
        const store = transaction.objectStore('conflicts');

        const conflict = {
            entityType,
            entityId,
            localData,
            serverData,
            timestamp: new Date().toISOString(),
            resolved: false,
            resolution: null
        };

        return new Promise((resolve, reject) => {
            const request = store.add(conflict);
            request.onsuccess = () => {
                console.log('⚠️ Conflict detected:', entityType, entityId);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get unresolved conflicts
     */
    async getUnresolvedConflicts() {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['conflicts'], 'readonly');
        const store = transaction.objectStore('conflicts');
        const index = store.index('resolved');

        return new Promise((resolve, reject) => {
            const request = index.getAll(false);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Resolve conflict
     */
    async resolveConflict(id, resolution, mergedData) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['conflicts'], 'readwrite');
        const store = transaction.objectStore('conflicts');

        return new Promise((resolve, reject) => {
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const conflict = getRequest.result;
                if (conflict) {
                    conflict.resolved = true;
                    conflict.resolution = resolution; // 'local', 'server', or 'merged'
                    conflict.mergedData = mergedData;
                    conflict.resolvedAt = new Date().toISOString();

                    const updateRequest = store.put(conflict);
                    updateRequest.onsuccess = () => resolve(conflict);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Conflict not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Cache circuit data
     */
    async cacheCircuit(circuitId, circuitData) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['circuitCache'], 'readwrite');
        const store = transaction.objectStore('circuitCache');

        const cache = {
            circuitId,
            data: circuitData,
            lastFetched: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const request = store.put(cache);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get cached circuit
     */
    async getCachedCircuit(circuitId) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['circuitCache'], 'readonly');
        const store = transaction.objectStore('circuitCache');

        return new Promise((resolve, reject) => {
            const request = store.get(circuitId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all data (for debugging/reset)
     */
    async clearAll() {
        if (!this.db) await this.init();

        const storeNames = ['syncQueue', 'offlineMessages', 'deliveryCache', 'conflicts', 'circuitCache'];
        
        for (const storeName of storeNames) {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
        
        console.log('🗑️ All offline data cleared');
    }

    /**
     * Get database statistics
     */
    async getStats() {
        if (!this.db) await this.init();

        const stats = {};
        const storeNames = ['syncQueue', 'offlineMessages', 'deliveryCache', 'conflicts', 'circuitCache'];

        for (const storeName of storeNames) {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            stats[storeName] = await new Promise((resolve, reject) => {
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        return stats;
    }
}

// Create global instance
window.mailiaOfflineDB = new MailiaOfflineDB();
