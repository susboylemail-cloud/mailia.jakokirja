import fs from 'fs/promises';
import path from 'path';
import { query } from '../config/database';
import logger from '../config/logger';
import { buildingKey as normBuilding, unitKey as normUnit, fixRepeatedAddress } from '../util/addressNormalization';
import fsSync from 'fs';

interface CSVSubscriber {
    address: string;
    buildingAddress: string;
    name: string;
    products: string[];
    orderIndex: number;
    apartment?: string;
    stairwell?: string;
    normalizedBuilding?: string;
    normalizedUnit?: string;
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

const splitCsvRows = (text: string): string[] => {
    const rows: string[] = [];
    let insideQuotes = false;
    let current = '';
    const sanitized = text.replace(/\ufeff/g, '');

    for (let i = 0; i < sanitized.length; i++) {
        const char = sanitized[i];
        const nextChar = sanitized[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
                current += char;
            }
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            if (current.length > 0) {
                rows.push(current.replace(/\r/g, ''));
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current.length > 0) {
        rows.push(current.replace(/\r/g, ''));
    }

    return rows.filter(row => row.trim().length > 0);
};

const tokenizeCsvFields = (line: string, delimiter: string): string[] => {
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
        } else if (char === delimiter && !insideQuotes) {
            fields.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    fields.push(currentField);

    return fields.map(field => field.replace(/\r/g, ''));
};

// Parse old format CSV (same as frontend)
const parseOldFormatCSVLine = (line: string, delimiter: string = ','): CSVSubscriber | null => {
    const effectiveDelimiter = delimiter || (line.includes(';') ? ';' : ',');
    const fields = tokenizeCsvFields(line, effectiveDelimiter);
    
    if (fields.length >= 5) {
        const street = fields[1].trim();
        const number = fields[2].trim();
        const name = fields[3].trim();
        const productsStr = fields[4].trim();
        
        if (!street || !number) return null;
        
        // Combine street name and number
        const address = `${street} ${number}`;
        
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
        const rows = splitCsvRows(fileContent);

        if (rows.length === 0) {
            throw new Error('Empty CSV file');
        }
        
        // Detect format and delimiter
        const header = rows[0].toLowerCase();
        const isNewFormat = header.includes('katu') && header.includes('osoitenumero');
        const headerDelimiter = rows[0].includes(';') && !rows[0].includes(',') ? ';' : ',';

        let subscribers: CSVSubscriber[] = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row.trim()) {
                continue;
            }

            let subscriber: CSVSubscriber | null;

            if (isNewFormat) {
                const fields = tokenizeCsvFields(row, headerDelimiter).map(f => f.trim());
                subscriber = parseNewFormatCSVLine(fields);
            } else {
                subscriber = parseOldFormatCSVLine(row, headerDelimiter);
            }

            if (subscriber) {
                // Apply repeated address fix & recompute buildingAddress
                subscriber.address = fixRepeatedAddress(subscriber.address);
                subscriber.buildingAddress = fixRepeatedAddress(subscriber.buildingAddress);
                subscriber.orderIndex = i;
                subscribers.push(subscriber);
            }
        }
        
        logger.info(`Parsed ${subscribers.length} subscribers from ${filename}`);

        // In-file dedupe: merge exact same address (case/space-insensitive) & merge products
        const before = subscribers.length;
        const seen = new Map<string, CSVSubscriber>();
        const order: string[] = [];
        const norm = (s: string) => s.toUpperCase().replace(/\s+/g,' ').trim();
        for (const sub of subscribers) {
            const key = norm(sub.address);
            if (!seen.has(key)) { seen.set(key, { ...sub, products: [...sub.products] }); order.push(key); }
            else {
                const prev = seen.get(key)!;
                const merged = new Set(prev.products);
                sub.products.forEach(p=>merged.add(p));
                prev.products = Array.from(merged);
                prev.orderIndex = Math.min(prev.orderIndex, sub.orderIndex);
            }
        }
        const deduped = order.map(k => seen.get(k)!);
        if (deduped.length !== before) {
            logger.info(`Deduped in-file: ${before} -> ${deduped.length} (${before - deduped.length} collapsed)`);
        }

        // Replace array with deduped version
        subscribers = deduped;
        
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
        // Load whitelist once (from repo root if exists)
        const rootDir = path.resolve(process.cwd(), '..', '..');
        const wlPath = path.join(rootDir, 'duplicates-whitelist.json');
        let whitelist: any = { buildings: [], units: [] };
        if (fsSync.existsSync(wlPath)) {
            try { whitelist = JSON.parse(fsSync.readFileSync(wlPath,'utf8')); } catch { logger.warn('Failed to parse duplicates-whitelist.json'); }
        }
        const isWhitelisted = (level: 'buildings'|'units', key: string): boolean => {
            const entries = whitelist[level] || [];
            return entries.some((e: any) => {
                if (typeof e === 'string') return e.toLowerCase() === key.toLowerCase();
                if (e && e.key) return String(e.key).toLowerCase() === key.toLowerCase();
                return false;
            });
        };

        const allowOverlap = process.env.IMPORT_ALLOW_OVERLAP === 'true';

        for (const subscriber of subscribers) {
            subscriber.normalizedBuilding = normBuilding(subscriber.buildingAddress);
            subscriber.normalizedUnit = normUnit(subscriber.buildingAddress, subscriber.stairwell, subscriber.apartment);

            // Cross-circuit duplicate guard (best-effort): check existing subscribers with same normalized unit
            const dupCheck = await query(
                `SELECT s.id, c.circuit_id FROM subscribers s JOIN circuits c ON s.circuit_id = c.id
                 WHERE LOWER(s.building_address) = LOWER($1)
                   AND COALESCE(LOWER(s.stairwell),'') = LOWER($2)
                   AND COALESCE(LOWER(s.apartment),'') = LOWER($3)
                   AND c.circuit_id <> $4
                 LIMIT 5`,
                [subscriber.buildingAddress, subscriber.stairwell || '', subscriber.apartment || '', circuitId]
            );
            if (dupCheck.rows.length) {
                const otherCircuits = dupCheck.rows.map(r => r.circuit_id);
                const key = subscriber.normalizedUnit;
                const whitelisted = isWhitelisted('units', key) || isWhitelisted('buildings', subscriber.normalizedBuilding!);
                if (!whitelisted) {
                    const msg = `High-risk overlap: ${subscriber.address} conflicts with circuits ${otherCircuits.join(', ')} (key=${key})`;
                    if (!allowOverlap) {
                        logger.warn(msg + ' -> skipped (set IMPORT_ALLOW_OVERLAP=true to force)');
                        continue; // Skip insertion
                    } else {
                        logger.warn(msg + ' -> allowed due to IMPORT_ALLOW_OVERLAP');
                    }
                }
            }
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
        
    logger.info(`Imported circuit ${circuitId} with ${subscribers.length} subscribers (after duplicate guard skips)`);
    } catch (error) {
        // Rollback on error
        await query('ROLLBACK');
        throw error;
    }
};

// Import all CSV files from a directory
export const importAllCSVFiles = async (directoryPath: string): Promise<void> => {
    try {
        console.log(`Scanning directory for CSV files: ${directoryPath}`);
        logger.info(`Scanning directory for CSV files: ${directoryPath}`);
        
        const files = await fs.readdir(directoryPath);
        const csvFiles = files.filter(file => file.toLowerCase().endsWith('.csv'));
        
        console.log(`Found ${csvFiles.length} CSV files`);
        logger.info(`Found ${csvFiles.length} CSV files`);
        
        for (const file of csvFiles) {
            const filePath = path.join(directoryPath, file);
            console.log(`Importing ${file}...`);
            try {
                await importCSVFile(filePath);
                console.log(`✓ Successfully imported ${file}`);
            } catch (error) {
                console.error(`✗ Failed to import ${file}:`, error);
                logger.error(`Failed to import ${file}:`, error);
                // Continue with other files
            }
        }
        
        console.log('CSV import completed');
        logger.info('CSV import completed');
    } catch (error) {
        console.error('Error importing CSV files:', error);
        logger.error('Error importing CSV files:', error);
        throw error;
    }
};
