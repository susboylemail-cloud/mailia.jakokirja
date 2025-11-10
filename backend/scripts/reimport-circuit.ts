/**
 * Re-import a specific circuit from CSV, replacing all existing data
 * Usage: tsx scripts/reimport-circuit.ts KP2
 */

import { importCSVFile } from '../src/services/csvImport';
import { query } from '../src/config/database';
import logger from '../src/config/logger';
import path from 'path';
import fs from 'fs/promises';

async function reimportCircuit(circuitId: string) {
    try {
        console.log(`\n=== Re-importing circuit ${circuitId} ===\n`);

        // Find the CSV file for this circuit
        const possibleFiles = [
            `${circuitId} DATA.csv`,
            `${circuitId.toLowerCase()}.csv`,
            `${circuitId}.csv`,
            `KP ${circuitId.replace('KP', '')} DATA.csv`,
            `kp ${circuitId.toLowerCase().replace('kp', '')}.csv`
        ];

        let csvFile = null;
        const rootDir = path.join(__dirname, '../..');

        for (const filename of possibleFiles) {
            const filePath = path.join(rootDir, filename);
            try {
                await fs.access(filePath);
                csvFile = filePath;
                console.log(`✓ Found CSV file: ${filename}`);
                break;
            } catch {
                // File doesn't exist, try next
            }
        }

        if (!csvFile) {
            console.error(`✗ Could not find CSV file for circuit ${circuitId}`);
            console.log('Tried:', possibleFiles.join(', '));
            process.exit(1);
        }

        // Get the circuit database ID
        const circuitResult = await query(
            'SELECT id FROM circuits WHERE circuit_id = $1',
            [circuitId]
        );

        if (circuitResult.rows.length === 0) {
            console.error(`✗ Circuit ${circuitId} not found in database`);
            process.exit(1);
        }

        const dbCircuitId = circuitResult.rows[0].id;

        // Count existing subscribers
        const existingCount = await query(
            'SELECT COUNT(*) FROM subscribers WHERE circuit_id = $1',
            [dbCircuitId]
        );
        console.log(`Found ${existingCount.rows[0].count} existing subscribers for ${circuitId}`);

        // Delete all existing subscribers and their products for this circuit
        console.log('\nDeleting existing data...');
        await query('BEGIN');
        
        const deleteProducts = await query(
            `DELETE FROM subscriber_products 
             WHERE subscriber_id IN (
                 SELECT id FROM subscribers WHERE circuit_id = $1
             )`,
            [dbCircuitId]
        );
        console.log(`✓ Deleted ${deleteProducts.rowCount} product entries`);

        const deleteSubscribers = await query(
            'DELETE FROM subscribers WHERE circuit_id = $1',
            [dbCircuitId]
        );
        console.log(`✓ Deleted ${deleteSubscribers.rowCount} subscribers`);

        await query('COMMIT');

        // Re-import from CSV
        console.log('\nRe-importing from CSV...');
        await importCSVFile(csvFile);

        // Check new count
        const newCount = await query(
            'SELECT COUNT(*) FROM subscribers WHERE circuit_id = $1',
            [dbCircuitId]
        );
        console.log(`\n✓ Successfully imported ${newCount.rows[0].count} subscribers for ${circuitId}`);

        // Show sample addresses to verify format
        console.log('\nSample addresses (first 5):');
        const samples = await query(
            `SELECT address, building_address, name 
             FROM subscribers 
             WHERE circuit_id = $1 
             ORDER BY order_index 
             LIMIT 5`,
            [dbCircuitId]
        );
        samples.rows.forEach((row, i) => {
            console.log(`  ${i + 1}. ${row.address} - ${row.name}`);
        });

        // Check for duplicates
        console.log('\nChecking for duplicates...');
        const duplicates = await query(
            `SELECT address, building_address, COUNT(*) as count
             FROM subscribers
             WHERE circuit_id = $1
             GROUP BY address, building_address
             HAVING COUNT(*) > 1`,
            [dbCircuitId]
        );

        if (duplicates.rows.length > 0) {
            console.warn(`⚠ Warning: Found ${duplicates.rows.length} duplicate address groups:`);
            duplicates.rows.forEach(dup => {
                console.log(`  - ${dup.address} (${dup.count} entries)`);
            });
        } else {
            console.log('✓ No duplicates found');
        }

    } catch (error) {
        await query('ROLLBACK');
        logger.error('Re-import error:', error);
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    const circuitId = process.argv[2];
    
    if (!circuitId) {
        console.error('Usage: tsx scripts/reimport-circuit.ts <CIRCUIT_ID>');
        console.error('Example: tsx scripts/reimport-circuit.ts KP2');
        process.exit(1);
    }

    reimportCircuit(circuitId.toUpperCase())
        .then(() => {
            console.log('\n✓ Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

export { reimportCircuit };
