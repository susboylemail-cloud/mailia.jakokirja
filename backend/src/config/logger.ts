import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_FILE_PATH || './logs';
const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (isProduction ? 'warn' : 'info'), // Less verbose in production
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'mailia-backend' },
    transports: [
        new winston.transports.File({ 
            filename: path.join(logDir, 'error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        ...(isProduction ? [] : [
            // Only log combined logs in development
            new winston.transports.File({ 
                filename: path.join(logDir, 'combined.log'),
                maxsize: 5242880, // 5MB
                maxFiles: 3,
            })
        ]),
    ],
});

if (!isProduction) {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
} else {
    // Minimal console logging in production (errors only)
    logger.add(new winston.transports.Console({
        level: 'error',
        format: winston.format.combine(
            winston.format.simple()
        )
    }));
}

export default logger;
