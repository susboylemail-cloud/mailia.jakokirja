import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Heroku provides DATABASE_URL in production
const poolConfig: PoolConfig = process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'mailia_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err: Error) => {
    console.error('===== DATABASE POOL ERROR =====');
    console.error('Unexpected error on idle client:', err);
    console.error('Pool config:', poolConfig);
    console.error('================================');
    // Don't exit - just log
    // process.exit(-1);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
