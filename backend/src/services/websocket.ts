import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';
import logger from '../config/logger';

let io: SocketIOServer;

export const initializeWebSocket = (socketIO: SocketIOServer) => {
    io = socketIO;

    io.use((socket: Socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            
            if (!token) {
                return next(new Error('Authentication error'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
            socket.data.user = decoded;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const user = socket.data.user as JWTPayload;
        logger.info(`WebSocket connected: ${user.username}`);

        // Join user's personal room
        socket.join(`user:${user.userId}`);

        // Handle delivery status updates
        socket.on('delivery:update', async (data) => {
            try {
                logger.info(`Delivery update from ${user.username}:`, data);
                
                // Broadcast to all connected clients for this route
                if (data.routeId) {
                    io.to(`route:${data.routeId}`).emit('delivery:updated', {
                        ...data,
                        updatedBy: user.username,
                        timestamp: new Date()
                    });
                }
            } catch (error) {
                logger.error('Delivery update error:', error);
                socket.emit('error', { message: 'Failed to update delivery' });
            }
        });

        // Handle route status updates
        socket.on('route:update', async (data) => {
            try {
                logger.info(`Route update from ${user.username}:`, data);
                
                const updateData = {
                    ...data,
                    updatedBy: user.username,
                    userId: user.userId,
                    timestamp: new Date()
                };
                
                // Broadcast route status to all connected users (not just route room)
                // This allows all users to see when routes are started/completed
                io.emit('route:updated', updateData);
                logger.info(`Broadcasted route:updated to all clients`, updateData);
                
                // Also broadcast to route room if routeId is present
                if (data.routeId) {
                    io.to(`route:${data.routeId}`).emit('route:updated', updateData);
                    logger.info(`Broadcasted route:updated to route:${data.routeId}`);
                }
            } catch (error) {
                logger.error('Route update error:', error);
                socket.emit('error', { message: 'Failed to update route' });
            }
        });

        // Handle working time updates
        socket.on('workingTime:update', async (data) => {
            try {
                logger.info(`Working time update from ${user.username}:`, data);
                
                // Broadcast to managers and admins
                io.to('role:admin').to('role:manager').emit('workingTime:updated', {
                    ...data,
                    userId: user.userId,
                    username: user.username,
                    timestamp: new Date()
                });
            } catch (error) {
                logger.error('Working time update error:', error);
                socket.emit('error', { message: 'Failed to update working time' });
            }
        });

        // Handle route messages
        socket.on('message:send', async (data) => {
            try {
                logger.info(`${data.message || 'Message'} from ${user.username}:`, data);
                
                const messageData = {
                    ...data,
                    userId: user.userId,
                    username: user.username,
                    timestamp: new Date()
                };
                
                // Broadcast message to all users (so everyone can see delivery issues)
                io.emit('message:received', messageData);
                logger.info(`Broadcasted message:received to all clients`);
                
                // Also broadcast to route room if routeId is present
                if (data.routeId) {
                    io.to(`route:${data.routeId}`).emit('message:received', messageData);
                    logger.info(`Broadcasted message:received to route:${data.routeId}`);
                }
            } catch (error) {
                logger.error('Message send error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Handle sync requests
        socket.on('sync:request', async (data) => {
            try {
                logger.info(`Sync request from ${user.username}:`, data);
                
                // Emit sync acknowledgment
                socket.emit('sync:acknowledged', {
                    syncId: data.syncId,
                    timestamp: new Date()
                });
            } catch (error) {
                logger.error('Sync request error:', error);
                socket.emit('error', { message: 'Sync failed' });
            }
        });

        // Join route rooms based on user's active routes
        socket.on('route:join', (routeId: number) => {
            socket.join(`route:${routeId}`);
            logger.info(`${user.username} joined route ${routeId}`);
        });

        // Leave route rooms
        socket.on('route:leave', (routeId: number) => {
            socket.leave(`route:${routeId}`);
            logger.info(`${user.username} left route ${routeId}`);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            logger.info(`WebSocket disconnected: ${user.username}`);
        });
    });

    logger.info('WebSocket server initialized');
};

// Broadcast subscription changes to all connected clients
export const broadcastSubscriptionChange = (change: any) => {
    if (io) {
        io.emit('subscription:changed', {
            ...change,
            timestamp: new Date()
        });
        logger.info('Broadcasted subscription change:', change);
    }
};

// Broadcast route update to all users (global broadcast)
export const broadcastRouteUpdate = (routeId: number, update: any) => {
    if (io) {
        const updateData = {
            ...update,
            routeId,
            timestamp: new Date()
        };
        
        // Broadcast to ALL connected clients (global)
        io.emit('route:updated', updateData);
        logger.info(`Broadcasted route:updated to all clients (route ${routeId})`, updateData);
    }
};

// Notify user about sync completion
export const notifySyncComplete = (userId: number, syncData: any) => {
    if (io) {
        io.to(`user:${userId}`).emit('sync:completed', {
            ...syncData,
            timestamp: new Date()
        });
    }
};

export { io };
