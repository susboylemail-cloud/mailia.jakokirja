import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Build a robust pool configuration that avoids unintended SSL usage in local dev.
// Preference order:
// 1) If USE_DATABASE_URL=true (or NODE_ENV=production) and DATABASE_URL is set -> use it, with optional SSL.
// 2) Otherwise, use discrete DB_* variables.

const useDatabaseUrl = (process.env.USE_DATABASE_URL === 'true' || process.env.NODE_ENV === 'production') && !!process.env.DATABASE_URL;
const dbSslEnabled = (process.env.DB_SSL === 'true'); // explicit SSL toggle for discrete config

let poolConfig: PoolConfig;

if (useDatabaseUrl) {
    // If DATABASE_URL is explicitly enabled, optionally apply SSL unless disabled
    const forceNoSsl = process.env.DB_SSL === 'false';
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        // Some hosted providers require SSL; allow explicit opt-out via DB_SSL=false
        ssl: forceNoSsl ? undefined : { rejectUnauthorized: false } as any,
    } as PoolConfig;
} else {
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'mailia_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: dbSslEnabled ? { rejectUnauthorized: false } as any : undefined,
    } as PoolConfig;
}

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
