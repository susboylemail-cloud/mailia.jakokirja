import SftpClient from 'ssh2-sftp-client';
import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { query } from '../config/database';
import logger from '../config/logger';
import { broadcastSubscriptionChange } from './websocket';

const sftp = new SftpClient();

interface SFTPConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
}

const getSFTPConfig = (): SFTPConfig => {
    return {
        host: process.env.SFTP_HOST || '',
        port: parseInt(process.env.SFTP_PORT || '22'),
        username: process.env.SFTP_USERNAME || '',
        password: process.env.SFTP_PASSWORD,
        privateKey: process.env.SFTP_PRIVATE_KEY_PATH
    };
};

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
    
    try {
        const config = getSFTPConfig();
        await sftp.connect(config);

        const remotePath = process.env.SFTP_REMOTE_PATH || '/subscriptions';
        const localPath = process.env.SFTP_LOCAL_PATH || './data/sftp_downloads';

        // Ensure local directory exists
        await fs.mkdir(localPath, { recursive: true });

        // List files in remote directory
        const fileList = await sftp.list(remotePath);

        for (const file of fileList) {
            if (file.type === '-' && file.name.endsWith('.csv')) {
                const remoteFilePath = path.posix.join(remotePath, file.name);
                const localFilePath = path.join(localPath, file.name);

                // Check if file already processed
                const exists = await fs.access(localFilePath).then(() => true).catch(() => false);
                
                if (!exists) {
                    logger.info(`Downloading: ${file.name}`);
                    await sftp.get(remoteFilePath, localFilePath);
                    downloadedFiles.push(localFilePath);
                    logger.info(`Downloaded: ${file.name}`);
                }
            }
        }

        await sftp.end();
    } catch (error) {
        logger.error('SFTP download error:', error);
        throw error;
    }

    return downloadedFiles;
};

// Sync subscription data from SFTP
export const syncSubscriptionData = async () => {
    try {
        logger.info('Starting SFTP subscription sync...');

        const downloadedFiles = await downloadNewFiles();

        for (const filePath of downloadedFiles) {
            const fileName = path.basename(filePath);
            await processSubscriptionFile(filePath, fileName);
        }

        logger.info(`SFTP sync completed. Processed ${downloadedFiles.length} files`);
    } catch (error) {
        logger.error('SFTP sync error:', error);
    }
};

// Start SFTP sync service with cron schedule
export const startSFTPSync = () => {
    const cronSchedule = process.env.SFTP_SYNC_INTERVAL || '*/15 * * * *'; // Every 15 minutes by default

    logger.info(`Starting SFTP sync service with schedule: ${cronSchedule}`);

    cron.schedule(cronSchedule, async () => {
        logger.info('Running scheduled SFTP sync...');
        await syncSubscriptionData();
    });

    // Run initial sync
    syncSubscriptionData();
};
