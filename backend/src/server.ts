import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import logger from './config/logger';
import authRoutes from './routes/auth';
import circuitRoutes from './routes/circuits';
import routeRoutes from './routes/routes';
import deliveryRoutes from './routes/deliveries';
import workingTimeRoutes from './routes/workingTimes';
import subscriptionRoutes from './routes/subscriptions';
import syncRoutes from './routes/sync';
import messageRoutes from './routes/messages';
import dashboardRoutes from './routes/dashboard';
import { initializeWebSocket } from './services/websocket';
import { startSFTPSync } from './services/sftpSync';
// import pool from './config/database';

dotenv.config();

// Test database connection on startup
// pool.connect((err, client, release) => {
//     if (err) {
//         logger.error('Failed to connect to database:', err);
//         process.exit(1);
//     }
//     logger.info('Database connected successfully');
//     if (client) {
//         release();
//     }
// });

const app: Express = express();

// Trust proxy for Heroku
app.set('trust proxy', 1);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5500',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for frontend
}));
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5500',
    credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../../');
    app.use(express.static(frontendPath, {
        maxAge: '1d',
        etag: true
    }));
}

// Logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/circuits', circuitRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/working-times', workingTimeRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend routes in production
if (process.env.NODE_ENV === 'production') {
    app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(__dirname, '../../index.html'));
    });
}

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
});

// Initialize WebSocket
initializeWebSocket(io);

// Start SFTP sync service
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SFTP_SYNC === 'true') {
    startSFTPSync();
}

// Start server
httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Client URL: ${process.env.CLIENT_URL || 'http://localhost:5500'}`);
});

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

export { io };
export default app;
