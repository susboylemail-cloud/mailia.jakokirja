import SftpClient from 'ssh2-sftp-client';
import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { query } from '../config/database';
import logger from '../config/logger';
import { broadcastSubscriptionChange } from './websocket';

// NOTE: We construct a fresh SftpClient per sync attempt to avoid lingering broken connections.
// Reuse inside a single sync run only.
let sftp: SftpClient | null = null;

// Concurrency guard so overlapping cron executions do not run at the same time.
let isSyncRunning = false;
// Guard to ensure startSFTPSync only wires cron once even if server imported twice.
let serviceStarted = false;

// Basic metrics (in‑memory). Could later be exposed via /health or metrics endpoint.
let metrics = {
    lastRunStarted: null as string | null,
    lastRunFinished: null as string | null,
    lastRunError: null as string | null,
    consecutiveFailures: 0,
    totalRuns: 0,
    totalFilesProcessed: 0
};

interface SFTPConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
}

const getSFTPConfig = (): SFTPConfig => ({
    host: process.env.SFTP_HOST || '',
    port: parseInt(process.env.SFTP_PORT || '22'),
    username: process.env.SFTP_USERNAME || '',
    password: process.env.SFTP_PASSWORD,
    privateKey: process.env.SFTP_PRIVATE_KEY_PATH
});

// Helper sleep
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Retry wrapper for establishing connection with exponential backoff & jitter.
async function connectWithRetry(config: SFTPConfig) {
    const maxRetries = parseInt(process.env.SFTP_MAX_RETRIES || '5');
    const baseDelay = parseInt(process.env.SFTP_RETRY_BASE_DELAY_MS || '2000');
    let attempt = 0;
    while (true) {
        attempt++;
        try {
            sftp = new SftpClient();
            await sftp.connect(config);
            if (attempt > 1) {
                logger.info(`SFTP connected after retry #${attempt - 1}`);
            }
            return;
        } catch (err: any) {
            const code = err?.code || err?.message;
            logger.error(`SFTP connect attempt ${attempt} failed (${code})`);
            if (attempt >= maxRetries) {
                throw err;
            }
            // Exponential backoff with jitter
            const wait = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 400);
            logger.info(`Waiting ${wait}ms before next SFTP connect attempt...`);
            await delay(wait);
        }
    }
}

async function safeEnd() {
    if (sftp) {
        try { await sftp.end(); } catch (e) { /* ignore */ }
    }
    sftp = null;
}

// Process downloaded CSV file
const processSubscriptionFile = async (filePath: string, fileName: string) => {
    try {
        logger.info(`Processing subscription file: ${fileName}`);

        const fileContent = await fs.readFile(filePath, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        logger.info(`Parsed ${records.length} records from ${fileName}`);

        for (const record of records) {
            await processSubscriptionRecord(record, fileName);
        }

        logger.info(`Completed processing ${fileName}`);
    } catch (error) {
        logger.error(`Error processing file ${fileName}:`, error);
        throw error;
    }
};

// Process individual subscription record
const processSubscriptionRecord = async (record: any, sourceFile: string) => {
    try {
        // Detect change type by comparing with existing data
        const circuitId = extractCircuitIdFromRecord(record);
        const address = extractAddressFromRecord(record);

        // Check if subscriber exists
        const existingSubscriber = await query(
            `SELECT s.*, c.circuit_id 
            FROM subscribers s 
            JOIN circuits c ON s.circuit_id = c.id 
            WHERE c.circuit_id = $1 AND s.address = $2`,
            [circuitId, address]
        );

        let changeType: 'new' | 'modified' | 'cancelled' = 'new';
        
        if (existingSubscriber.rows.length > 0) {
            // Check if this is a cancellation or modification
            if (record.status && record.status.toLowerCase() === 'cancelled') {
                changeType = 'cancelled';
            } else {
                changeType = 'modified';
            }
        }

        // Store subscription change
        await query(
            `INSERT INTO subscription_changes 
            (circuit_id, change_type, subscriber_data, source_file, sftp_timestamp) 
            VALUES (
                (SELECT id FROM circuits WHERE circuit_id = $1), 
                $2, $3, $4, NOW()
            )`,
            [circuitId, changeType, JSON.stringify(record), sourceFile]
        );

        // Broadcast change in real-time
        broadcastSubscriptionChange({
            circuitId,
            changeType,
            address,
            sourceFile
        });

        logger.info(`Recorded ${changeType} for ${circuitId} - ${address}`);
    } catch (error) {
        logger.error('Error processing subscription record:', error);
    }
};

// Extract circuit ID from subscription data
const extractCircuitIdFromRecord = (record: any): string => {
    // Try common field names
    if (record.circuit_id) return record.circuit_id;
    if (record.circuitId) return record.circuitId;
    if (record.circuit) return record.circuit;
    if (record.piiri) return record.piiri;
    
    // Try to extract from filename or other fields
    if (record.route) return record.route;
    
    return 'UNKNOWN';
};

// Extract address from subscription data
const extractAddressFromRecord = (record: any): string => {
    const parts = [];
    
    if (record.street || record.katu) {
        parts.push(record.street || record.katu);
    }
    
    if (record.number || record.numero || record.osoitenumero) {
        parts.push(record.number || record.numero || record.osoitenumero);
    }
    
    if (record.stairwell || record.porras) {
        parts.push(record.stairwell || record.porras);
    }
    
    if (record.apartment || record.asunto) {
        parts.push(record.apartment || record.asunto);
    }
    
    return parts.join(' ').trim();
};

// Download new files from SFTP
const downloadNewFiles = async (): Promise<string[]> => {
    const downloadedFiles: string[] = [];
    const config = getSFTPConfig();

    // Quick sanity check – skip if mandatory config missing (avoid noisy ECONNREFUSED spam)
    if (!config.host || !config.username) {
        logger.warn('SFTP disabled: missing SFTP_HOST / SFTP_USERNAME');
        return downloadedFiles;
    }

    try {
        await connectWithRetry(config);
        const remotePath = process.env.SFTP_REMOTE_PATH || '/subscriptions';
        const localPath = process.env.SFTP_LOCAL_PATH || './data/sftp_downloads';
        await fs.mkdir(localPath, { recursive: true });
        const fileList = await sftp!.list(remotePath);

        for (const file of fileList) {
            if (file.type !== '-' || !file.name.endsWith('.csv')) continue;
            const remoteFilePath = path.posix.join(remotePath, file.name);
            const localFilePath = path.join(localPath, file.name);

            // Determine if file should be downloaded (new or updated) by comparing size & mod time.
            let shouldDownload = false;
            try {
                const stat = await fs.stat(localFilePath);
                // If remote size differs or remote modify time newer, re‑download.
                if (stat.size !== file.size || (file.modifyTime && stat.mtimeMs + 1000 < file.modifyTime)) {
                    shouldDownload = true;
                }
            } catch { // file does not exist
                shouldDownload = true;
            }

            if (shouldDownload) {
                try {
                    logger.info(`Downloading SFTP file: ${file.name}`);
                    await sftp!.get(remoteFilePath, localFilePath);
                    downloadedFiles.push(localFilePath);
                } catch (fileErr: any) {
                    logger.error(`Failed downloading ${file.name}:`, fileErr);
                }
            }
        }
    } catch (error) {
        logger.error('SFTP download error (aborting this run):', error);
        throw error;
    } finally {
        await safeEnd();
    }
    return downloadedFiles;
};

// Sync subscription data from SFTP
export const syncSubscriptionData = async () => {
    if (isSyncRunning) {
        logger.warn('Previous SFTP sync still running – skipping overlapping invocation');
        return;
    }
    isSyncRunning = true;
    metrics.lastRunStarted = new Date().toISOString();
    metrics.totalRuns += 1;
    const start = Date.now();
    try {
        logger.info('Starting SFTP subscription sync...');
        const downloadedFiles = await downloadNewFiles();
        let processed = 0;
        for (const filePath of downloadedFiles) {
            const fileName = path.basename(filePath);
            try {
                await processSubscriptionFile(filePath, fileName);
                processed++;
            } catch (fileErr) {
                logger.error(`Processing failed for ${fileName}:`, fileErr);
            }
        }
        metrics.totalFilesProcessed += processed;
        metrics.consecutiveFailures = 0;
        metrics.lastRunError = null;
        logger.info(`SFTP sync completed in ${Date.now() - start}ms. Files processed: ${processed}`);
    } catch (error: any) {
        metrics.consecutiveFailures += 1;
        metrics.lastRunError = error?.message || 'unknown error';
        logger.error('SFTP sync error:', error);
        const maxFailBeforeSilence = parseInt(process.env.SFTP_FAILURE_ALERT_THRESHOLD || '10');
        if (metrics.consecutiveFailures === maxFailBeforeSilence) {
            logger.error(`SFTP sync has failed ${metrics.consecutiveFailures} times consecutively – suppressing further identical logs until a success.`);
        }
    } finally {
        metrics.lastRunFinished = new Date().toISOString();
        isSyncRunning = false;
    }
};

// Start SFTP sync service with cron schedule
export const startSFTPSync = () => {
    if (serviceStarted) {
        logger.warn('startSFTPSync called more than once – ignoring subsequent call');
        return;
    }
    serviceStarted = true;
    const cronSchedule = process.env.SFTP_SYNC_INTERVAL || '*/15 * * * *'; // Every 15 minutes by default
    logger.info(`Starting SFTP sync service with schedule: ${cronSchedule}`);
    try {
        cron.schedule(cronSchedule, async () => {
            logger.info('Running scheduled SFTP sync...');
            await syncSubscriptionData();
        });
    } catch (e) {
        logger.error('Failed to schedule SFTP cron job:', e);
    }
    // Optional initial sync (can be disabled via env)
    if (process.env.SFTP_RUN_INITIAL_SYNC !== 'false') {
        syncSubscriptionData();
    } else {
        logger.info('Initial SFTP sync skipped (SFTP_RUN_INITIAL_SYNC=false)');
    }
};

// Export metrics for potential future diagnostics
export const getSftpMetrics = () => ({ ...metrics });
