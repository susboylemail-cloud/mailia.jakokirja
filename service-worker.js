// Mailia Service Worker - Offline Support & Caching
const CACHE_VERSION = 'mailia-v84';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;
const TILE_CACHE = `${CACHE_VERSION}-osm-tiles`;
const MAX_OSM_TILE_ENTRIES = 256; // Respectful limit for client-side caching

// Assets to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css?v=83',
    '/api.js?v=83',
    '/app.js?v=83',
    '/translations.js?v=83',
    '/manifest.json?v=79',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing ${CACHE_VERSION}...`);
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activating ${CACHE_VERSION}...`);
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            // Delete all old mailia caches except current ones
                            return name.startsWith('mailia-') && 
                                   name !== STATIC_CACHE && 
                                   name !== DYNAMIC_CACHE && 
                                   name !== API_CACHE &&
                                   name !== TILE_CACHE;
                        })
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Claiming clients...');
                return self.clients.claim();
            })
            .then(() => {
                // Notify all clients to reload
                return self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({ 
                            type: 'CACHE_UPDATED',
                            version: CACHE_VERSION 
                        });
                    });
                });
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and chrome-extension requests
    if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
        return;
    }

    // Cache OpenStreetMap tiles with stale-while-revalidate strategy
    if (url.hostname.endsWith('tile.openstreetmap.org')) {
        event.respondWith(tileStaleWhileRevalidateStrategy(event));
        return;
    }

    // Handle API requests with network-first strategy
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstStrategy(request, API_CACHE));
        return;
    }

    // Handle static assets with cache-first strategy
    event.respondWith(cacheFirstStrategy(request));
});

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.error('[SW] Cache-first strategy failed:', error);
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            const cache = await caches.open(STATIC_CACHE);
            return cache.match('/index.html');
        }
        
        throw error;
    }
}

// Network-first strategy for API requests
async function networkFirstStrategy(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful API responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return a custom offline response for API failures
        return new Response(
            JSON.stringify({ 
                error: 'Offline', 
                message: 'No network connection. Data may be stale.' 
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                    'Content-Type': 'application/json'
                })
            }
        );
    }
}

// Stale-while-revalidate for OpenStreetMap tiles
async function tileStaleWhileRevalidateStrategy(event) {
    const { request } = event;
    const cache = await caches.open(TILE_CACHE);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request)
        .then(async (networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
                await cache.put(request, networkResponse.clone());
                trimTileCache(cache);
            }
            return networkResponse;
        })
        .catch((error) => {
            console.warn('[SW] Tile fetch failed:', error);
            return null;
        });

    // Return cached tile immediately if available, otherwise wait for network
    if (cachedResponse) {
        // Kick off update in background
        event.waitUntil(fetchPromise);
        return cachedResponse;
    }

    const networkResponse = await fetchPromise;
    if (networkResponse) {
        return networkResponse;
    }

    // If both cache and network fail, respond with generic fallback
    return new Response(null, { status: 504, statusText: 'Tile Unavailable' });
}

async function trimTileCache(cache) {
    const keys = await cache.keys();
    if (keys.length <= MAX_OSM_TILE_ENTRIES) return;

    const deleteCount = keys.length - MAX_OSM_TILE_ENTRIES;
    for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
    }
}

// Listen for messages from the main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((name) => caches.delete(name))
                );
            })
        );
    }
});

