/**
 * Remove duplicate subscriber entries from database
 * Keeps the oldest entry for each unique circuit_id + address + building_address combination
 */

import { query } from '../src/config/database';
import logger from '../src/config/logger';

async function removeDuplicates() {
    try {
        console.log('Starting duplicate removal process...\n');

        // First, check how many duplicates exist
        const duplicateCheck = await query(`
            SELECT circuit_id, address, building_address, COUNT(*) as count
            FROM subscribers
            GROUP BY circuit_id, address, building_address
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        `);

        console.log(`Found ${duplicateCheck.rows.length} sets of duplicate entries`);
        
        if (duplicateCheck.rows.length === 0) {
            console.log('No duplicates found!');
            return;
        }

        // Show sample duplicates
        console.log('\nSample duplicates:');
        duplicateCheck.rows.slice(0, 10).forEach(row => {
            console.log(`  ${row.circuit_id} - ${row.address} (${row.building_address}): ${row.count} entries`);
        });

        console.log('\n=== Removing duplicates ===\n');

        // Delete duplicates, keeping only the oldest entry (lowest id) for each group
        const deleteResult = await query(`
            DELETE FROM subscribers
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY circuit_id, address, building_address 
                               ORDER BY id ASC
                           ) AS row_num
                    FROM subscribers
                ) sub
                WHERE row_num > 1
            )
        `);

        console.log(`✓ Deleted ${deleteResult.rowCount} duplicate entries\n`);

        // Verify no duplicates remain
        const verifyCheck = await query(`
            SELECT circuit_id, address, building_address, COUNT(*) as count
            FROM subscribers
            GROUP BY circuit_id, address, building_address
            HAVING COUNT(*) > 1
        `);

        if (verifyCheck.rows.length === 0) {
            console.log('✓ All duplicates removed successfully!');
        } else {
            console.error(`⚠ Warning: Still found ${verifyCheck.rows.length} duplicate sets`);
        }

        // Show total subscribers count
        const totalCount = await query('SELECT COUNT(*) as total FROM subscribers');
        console.log(`\nTotal subscribers remaining: ${totalCount.rows[0].total}`);

    } catch (error) {
        logger.error('Error removing duplicates:', error);
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    removeDuplicates()
        .then(() => {
            console.log('\n✓ Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

export { removeDuplicates };
