/**
 * Mailia Backend API Client
 * Handles all communication with the Node.js backend server
 */

// Auto-detect production vs development
const IS_PRODUCTION = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_BASE_URL = IS_PRODUCTION ? '/api' : 'http://localhost:3000/api';
const WS_URL = IS_PRODUCTION ? window.location.origin : 'http://localhost:3000';

class MailiaAPI {
    constructor() {
        this.token = localStorage.getItem('mailiaAuthToken');
        this.refreshToken = localStorage.getItem('mailiaRefreshToken');
        this.user = JSON.parse(localStorage.getItem('mailiaUser') || 'null');
        this.socket = null;
        this.isOnline = navigator.onLine;
        
        // Setup online/offline detection
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Network: Online');
            this.syncOfflineQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Network: Offline');
        });
    }

    // ============= Authentication =============
    
    async login(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Login failed');
            }

            const data = await response.json();
            console.log('Login response data:', data); // Debug: see what backend sends
            this.token = data.accessToken || data.token; // Backend sends 'accessToken'
            this.refreshToken = data.refreshToken;
            this.user = data.user;
            
            console.log('Token set to:', this.token); // Debug: verify token is set

            // Store in localStorage
            localStorage.setItem('mailiaAuthToken', this.token);
            localStorage.setItem('mailiaRefreshToken', this.refreshToken);
            localStorage.setItem('mailiaUser', JSON.stringify(this.user));
            localStorage.setItem('mailiaUserRole', this.user.role); // Store role separately for UI checks

            // Connect WebSocket
            this.connectWebSocket();

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async logout() {
        try {
            if (this.token) {
                await this.makeRequest('/auth/logout', { method: 'POST' });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage
            this.token = null;
            this.refreshToken = null;
            this.user = null;
            localStorage.removeItem('mailiaAuthToken');
            localStorage.removeItem('mailiaRefreshToken');
            localStorage.removeItem('mailiaUser');
            
            // Disconnect WebSocket
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
            }
        }
    }

    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    getCurrentUser() {
        return this.user;
    }

    // ============= HTTP Request Helper =============
    
    async makeRequest(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        } else {
            console.warn('makeRequest: No token available for', endpoint);
        }

        console.log('Making request to:', endpoint, 'with token:', this.token ? 'YES' : 'NO');

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // Handle token expiration
            if (response.status === 401 && this.refreshToken) {
                const refreshed = await this.refreshAuthToken();
                if (refreshed) {
                    // Retry request with new token
                    headers['Authorization'] = `Bearer ${this.token}`;
                    const retryResponse = await fetch(url, { ...options, headers });
                    return await this.handleResponse(retryResponse);
                }
            }

            return await this.handleResponse(response);
        } catch (error) {
            console.error('Request error:', error);
            throw error;
        }
    }

    async handleResponse(response) {
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }
        return await response.json();
    }

    async refreshAuthToken() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });

            if (!response.ok) {
                await this.logout();
                return false;
            }

            const data = await response.json();
            this.token = data.accessToken || data.token; // Backend sends 'accessToken'
            localStorage.setItem('mailiaAuthToken', this.token);
            return true;
        } catch (error) {
            console.error('Token refresh error:', error);
            await this.logout();
            return false;
        }
    }

    // ============= Circuits =============
    
    async getCircuits() {
        return await this.makeRequest('/circuits');
    }

    async getCircuit(circuitId) {
        return await this.makeRequest(`/circuits/${circuitId}`);
    }

    async getCircuitSubscribers(circuitId) {
        return await this.makeRequest(`/circuits/${circuitId}/subscribers`);
    }

    // ============= Routes =============
    
    async getTodayRoutes() {
        return await this.makeRequest('/routes/today');
    }
    
    async startRoute(circuitId, routeDate = new Date().toISOString().split('T')[0]) {
        return await this.makeRequest('/routes/start', {
            method: 'POST',
            body: JSON.stringify({ circuitId, routeDate })
        });
    }

    async completeRoute(routeId) {
        return await this.makeRequest(`/routes/${routeId}/complete`, {
            method: 'POST'
        });
    }

    async resetRoute(routeId, newStatus = 'not-started') {
        return await this.makeRequest(`/routes/${routeId}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newStatus })
        });
    }

    async getRouteStatus(circuitId, routeDate = new Date().toISOString().split('T')[0]) {
        return await this.makeRequest(`/routes/status?circuitId=${circuitId}&routeDate=${routeDate}`);
    }

    async getUserRoutes(userId, routeDate = new Date().toISOString().split('T')[0]) {
        return await this.makeRequest(`/routes/user/${userId}?routeDate=${routeDate}`);
    }

    // ============= Messages =============
    
    async getTodayMessages() {
        return await this.makeRequest('/messages/today');
    }
    
    async sendMessage(routeId, messageType, message) {
        return await this.makeRequest('/messages', {
            method: 'POST',
            body: JSON.stringify({ routeId, messageType, message })
        });
    }

    async markMessageAsRead(messageId) {
        return await this.makeRequest(`/messages/${messageId}/read`, {
            method: 'POST'
        });
    }

    async deleteMessage(messageId) {
        return await this.makeRequest(`/routes/messages/${messageId}`, {
            method: 'DELETE'
        });
    }

    // ============= Deliveries =============
    
    async updateDelivery(routeId, subscriberId, isDelivered) {
        return await this.makeRequest('/deliveries/update', {
            method: 'POST',
            body: JSON.stringify({ routeId, subscriberId, isDelivered })
        });
    }

    async getRouteDeliveries(routeId) {
        return await this.makeRequest(`/deliveries/route/${routeId}`);
    }

    // ============= Working Times =============
    
    async clockIn() {
        return await this.makeRequest('/working-times/clock-in', {
            method: 'POST'
        });
    }

    async clockOut() {
        return await this.makeRequest('/working-times/clock-out', {
            method: 'POST'
        });
    }

    async getWorkingTimes(startDate, endDate) {
        return await this.makeRequest(`/working-times?startDate=${startDate}&endDate=${endDate}`);
    }

    // ============= WebSocket Real-time Sync =============
    
    connectWebSocket() {
        if (!this.token || this.socket?.connected) {
            return;
        }

        // Load Socket.IO from CDN
        if (!window.io) {
            const script = document.createElement('script');
            script.src = 'https://cdn.socket.io/4.6.1/socket.io.min.js';
            script.onload = () => this.initializeWebSocket();
            document.head.appendChild(script);
        } else {
            this.initializeWebSocket();
        }
    }

    initializeWebSocket() {
        this.socket = io(WS_URL, {
            auth: { token: this.token }
        });

        this.socket.on('connect', () => {
            console.log('WebSocket connected');
        });

        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
        });

        this.socket.on('delivery:updated', (data) => {
            console.log('Delivery updated:', data);
            // Trigger custom event for app.js to handle
            window.dispatchEvent(new CustomEvent('deliveryUpdated', { detail: data }));
        });

        this.socket.on('route:started', (data) => {
            console.log('Route started:', data);
            window.dispatchEvent(new CustomEvent('routeStarted', { detail: data }));
        });

        this.socket.on('route:completed', (data) => {
            console.log('Route completed:', data);
            window.dispatchEvent(new CustomEvent('routeCompleted', { detail: data }));
        });

        this.socket.on('subscription:changed', (data) => {
            console.log('Subscription changed:', data);
            window.dispatchEvent(new CustomEvent('subscriptionChanged', { detail: data }));
        });

        this.socket.on('subscriber_updated', (data) => {
            console.log('Subscriber updated:', data);
            window.dispatchEvent(new CustomEvent('subscriberUpdated', { detail: data }));
        });

        this.socket.on('route:updated', (data) => {
            console.log('Route updated:', data);
            window.dispatchEvent(new CustomEvent('routeUpdated', { detail: data }));
        });

        this.socket.on('message:received', (data) => {
            console.log('Message received:', data);
            window.dispatchEvent(new CustomEvent('messageReceived', { detail: data }));
        });

        this.socket.on('message:read', (data) => {
            console.log('Message marked as read:', data);
            window.dispatchEvent(new CustomEvent('messageRead', { detail: data }));
        });
    }

    // Emit route update to WebSocket
    emitRouteUpdate(routeData) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('route:update', routeData);
            console.log('Emitted route:update', routeData);
        }
    }

    // Emit message to WebSocket
    emitMessage(messageData) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('message:send', messageData);
            console.log('Emitted message:send', messageData);
        }
    }

    // Join a route room for real-time updates
    joinRoute(routeId) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('route:join', routeId);
            console.log('Joined route room:', routeId);
        }
    }

    // ============= Dashboard =============
    
    async getDashboardRouteTimes(startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return await this.makeRequest(`/dashboard/route-times?${params.toString()}`);
    }

    async getDashboardDailyStats(startDate, endDate) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return await this.makeRequest(`/dashboard/daily-stats?${params.toString()}`);
    }

    async getDashboardMonthlyStats(year, month) {
        const params = new URLSearchParams();
        if (year) params.append('year', year);
        if (month) params.append('month', month);
        return await this.makeRequest(`/dashboard/monthly-stats?${params.toString()}`);
    }

    async getTodayDeliveryCount() {
        return await this.makeRequest('/dashboard/today-delivery-count');
    }

    async getPeriodDeliveryCount(year, month) {
        const params = new URLSearchParams();
        params.append('year', year);
        if (month) params.append('month', month);
        return await this.makeRequest(`/dashboard/period-delivery-count?${params.toString()}`);
    }

    async getMonthlyDeliveryReport(year, month) {
        const params = new URLSearchParams();
        params.append('year', year);
        params.append('month', month);
        return await this.makeRequest(`/dashboard/monthly-delivery-report?${params.toString()}`);
    }

    async storeDailyStats(statDate) {
        return await this.makeRequest('/dashboard/store-daily-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ statDate })
        });
    }

    async storeMonthlyStats(year, month) {
        return await this.makeRequest('/dashboard/store-monthly-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, month })
        });
    }

    async storeYearlyStats(year) {
        return await this.makeRequest('/dashboard/store-yearly-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year })
        });
    }

    async getHistoricalMonthlyStats(year, month, circuitId) {
        const params = new URLSearchParams();
        if (year) params.append('year', year);
        if (month) params.append('month', month);
        if (circuitId) params.append('circuitId', circuitId);
        return await this.makeRequest(`/dashboard/historical-monthly-stats?${params.toString()}`);
    }

    async getHistoricalYearlyStats(year, circuitId) {
        const params = new URLSearchParams();
        if (year) params.append('year', year);
        if (circuitId) params.append('circuitId', circuitId);
        return await this.makeRequest(`/dashboard/historical-yearly-stats?${params.toString()}`);
    }

    // ============= Offline Support with IndexedDB =============
    
    async syncOfflineQueue() {
        // This will be implemented with IndexedDB
        console.log('Syncing offline queue...');
        // TODO: Implement IndexedDB queue processing
    }

    async addToOfflineQueue(action, data) {
        // Store action in IndexedDB for later sync
        console.log('Added to offline queue:', action, data);
        // TODO: Implement IndexedDB storage
    }
}

// Create global API instance
window.mailiaAPI = new MailiaAPI();
