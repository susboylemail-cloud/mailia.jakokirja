import { query } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations() {
    console.log('Running database migrations...');
    
    const migrationsDir = path.join(__dirname, '../database/migrations');
    
    // Create migrations tracking table if it doesn't exist
    await query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Get list of executed migrations
    const executed = await query('SELECT filename FROM migrations');
    const executedFiles = new Set(executed.rows.map(r => r.filename));
    
    // Read migration files
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    
    for (const file of files) {
        if (executedFiles.has(file)) {
            console.log(`Skipping already executed migration: ${file}`);
            continue;
        }
        
        console.log(`Executing migration: ${file}`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        try {
            await query(sql);
            await query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
            console.log(`✓ Successfully executed: ${file}`);
        } catch (error) {
            console.error(`✗ Failed to execute ${file}:`, error);
            throw error;
        }
    }
    
    console.log('Migrations completed successfully!');
    process.exit(0);
}

runMigrations().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});
