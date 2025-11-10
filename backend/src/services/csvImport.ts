import fs from 'fs/promises';
import path from 'path';
import { query } from '../config/database';
import logger from '../config/logger';

interface CSVSubscriber {
    address: string;
    buildingAddress: string;
    name: string;
    products: string[];
    orderIndex: number;
    apartment?: string;
    stairwell?: string;
}

// Extract circuit ID from filename (same logic as frontend)
export const extractCircuitId = (filename: string): string => {
    const lower = filename.toLowerCase();
    
    // New format: kp13.csv, kp44.csv, kpr5.csv, kpr6.csv, kp r1.csv
    if (lower.match(/^kp\s*r?\s*\d+[ab]?\.csv$/i)) {
        const match = lower.match(/^kp\s*(r)?\s*(\d+[ab]?)\.csv$/i);
        if (match) {
            const r = match[1] ? 'R' : '';
            const number = match[2].toUpperCase();
            return 'KP' + r + number;
        }
    }
    
    // Old format: "KP3 DATA.csv", "KP R2 DATA.csv", "K28 DATA.csv"
    const match = filename.match(/^(K|KP)\s*(R\s*)?(\d+[AB]?)\s*DATA\.csv$/i);
    if (match) {
        const prefix = match[1] === 'K' ? 'KP' : 'KP';
        const r = match[2] ? 'R' : '';
        const number = match[3];
        return prefix + r + number;
    }
    
    return filename.replace(' DATA.csv', '').replace('.csv', '').replace(/\s+/g, '').toUpperCase();
};

// Parse old format CSV (same as frontend)
const parseOldFormatCSVLine = (line: string): CSVSubscriber | null => {
    const fields: string[] = [];
    let currentField = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            fields.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    fields.push(currentField);
    
    if (fields.length >= 5) {
        const address = fields[2].trim();
        const name = fields[3].trim();
        const productsStr = fields[4].trim();
        
        if (!address) return null;
        
        const products = productsStr.split(/[\n,]+/).map(p => p.trim()).filter(p => p);
        
        return {
            address,
            name,
            products,
            buildingAddress: extractBuildingAddress(address),
            orderIndex: 0
        };
    }
    
    return null;
};

// Parse new format CSV
const parseNewFormatCSVLine = (fields: string[]): CSVSubscriber | null => {
    if (fields.length >= 6) {
        const street = fields[0].trim();
        const number = fields[1].trim();
        const stairwell = fields[2].trim();
        const apartment = fields[3].trim();
        const name = fields[4].trim();
        const productsStr = fields[5].trim();
        
        if (!street || !number) return null;
        
        let address = `${street} ${number}`;
        if (stairwell) address += ` ${stairwell}`;
        if (apartment) address += ` ${apartment}`;
        
        const productMatches = productsStr.matchAll(/([A-Z]+\d*)/g);
        const products = Array.from(productMatches, m => m[1]);
        
        return {
            address,
            name,
            products: products.length > 0 ? products : [productsStr.trim()],
            buildingAddress: extractBuildingAddress(address),
            apartment,
            stairwell,
            orderIndex: 0
        };
    }
    
    return null;
};

// Extract building address (same as frontend)
const extractBuildingAddress = (address: string): string => {
    const parts = address.split(' ');
    let building = '';
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (i === 0 || !/^\d/.test(part)) {
            building += (building ? ' ' : '') + part;
        } else if (/^\d+$/.test(part)) {
            building += ' ' + part;
        } else if (/^[A-Za-z]{1,3}$/.test(part)) {
            building += ' ' + part.toUpperCase();
            break;
        }
    }
    
    return building || address;
};

// Import a CSV file into the database
export const importCSVFile = async (filePath: string): Promise<void> => {
    try {
        const filename = path.basename(filePath);
        const circuitId = extractCircuitId(filename);
        
        logger.info(`Importing CSV file: ${filename} as circuit ${circuitId}`);
        
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const lines = fileContent.trim().split('\n');
        
        if (lines.length === 0) {
            throw new Error('Empty CSV file');
        }
        
        // Detect format
        const header = lines[0].toLowerCase();
        const isNewFormat = header.includes('katu') && header.includes('osoitenumero');
        
        const subscribers: CSVSubscriber[] = [];
        
        // Parse each line
        for (let i = 1; i < lines.length; i++) {
            let subscriber: CSVSubscriber | null;
            
            if (isNewFormat) {
                const fields = lines[i].split(',').map(f => f.trim());
                subscriber = parseNewFormatCSVLine(fields);
            } else {
                subscriber = parseOldFormatCSVLine(lines[i]);
            }
            
            if (subscriber) {
                subscriber.orderIndex = i;
                subscribers.push(subscriber);
            }
        }
        
        logger.info(`Parsed ${subscribers.length} subscribers from ${filename}`);
        
        // Import into database
        await importCircuitData(circuitId, filename, subscribers);
        
        logger.info(`Successfully imported ${filename}`);
    } catch (error) {
        logger.error(`Error importing CSV file ${filePath}:`, error);
        throw error;
    }
};

// Import circuit and subscribers into database
const importCircuitData = async (circuitId: string, circuitName: string, subscribers: CSVSubscriber[]): Promise<void> => {
    try {
        // Begin transaction
        await query('BEGIN');
        
        // Create or update circuit
        const circuitResult = await query(
            `INSERT INTO circuits (circuit_id, circuit_name, is_active)
            VALUES ($1, $2, true)
            ON CONFLICT (circuit_id) 
            DO UPDATE SET circuit_name = $2, updated_at = NOW()
            RETURNING id`,
            [circuitId, circuitName]
        );
        
        const dbCircuitId = circuitResult.rows[0].id;
        
        // Import subscribers
        for (const subscriber of subscribers) {
            // Insert or update subscriber
            const subscriberResult = await query(
                `INSERT INTO subscribers (
                    circuit_id, address, building_address, name, 
                    apartment, stairwell, order_index, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                ON CONFLICT (circuit_id, address)
                DO UPDATE SET 
                    building_address = $3,
                    name = $4,
                    apartment = $5,
                    stairwell = $6,
                    order_index = $7,
                    is_active = true,
                    updated_at = NOW()
                RETURNING id`,
                [
                    dbCircuitId,
                    subscriber.address,
                    subscriber.buildingAddress,
                    subscriber.name,
                    subscriber.apartment,
                    subscriber.stairwell,
                    subscriber.orderIndex
                ]
            );
            
            const subscriberId = subscriberResult.rows[0].id;
            
            // Delete old products for this subscriber
            await query(
                'DELETE FROM subscriber_products WHERE subscriber_id = $1',
                [subscriberId]
            );
            
            // Insert products
            for (const product of subscriber.products) {
                await query(
                    `INSERT INTO subscriber_products (subscriber_id, product_code, quantity, is_active)
                    VALUES ($1, $2, 1, true)`,
                    [subscriberId, product]
                );
            }
        }
        
        // Commit transaction
        await query('COMMIT');
        
        logger.info(`Imported circuit ${circuitId} with ${subscribers.length} subscribers`);
    } catch (error) {
        // Rollback on error
        await query('ROLLBACK');
        throw error;
    }
};

// Import all CSV files from a directory
export const importAllCSVFiles = async (directoryPath: string): Promise<void> => {
    try {
        logger.info(`Scanning directory for CSV files: ${directoryPath}`);
        
        const files = await fs.readdir(directoryPath);
        const csvFiles = files.filter(file => file.toLowerCase().endsWith('.csv'));
        
        logger.info(`Found ${csvFiles.length} CSV files`);
        
        for (const file of csvFiles) {
            const filePath = path.join(directoryPath, file);
            try {
                await importCSVFile(filePath);
            } catch (error) {
                logger.error(`Failed to import ${file}:`, error);
                // Continue with other files
            }
        }
        
        logger.info('CSV import completed');
    } catch (error) {
        logger.error('Error importing CSV files:', error);
        throw error;
    }
};
