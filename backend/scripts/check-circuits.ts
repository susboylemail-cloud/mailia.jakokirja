/**
 * Check all circuits for potential address issues
 * Identifies circuits with addresses that are only numbers (missing street names)
 */

import { query } from '../src/config/database';
import logger from '../src/config/logger';

async function checkAllCircuits() {
    try {
        console.log('\n=== Checking all circuits for address issues ===\n');

        // Get all circuits
        const circuits = await query(
            'SELECT id, circuit_id FROM circuits WHERE is_active = true ORDER BY circuit_id'
        );

        console.log(`Checking ${circuits.rows.length} circuits...\n`);

        const problemCircuits = [];

        for (const circuit of circuits.rows) {
            const { id, circuit_id } = circuit;

            // Check for addresses that are only numbers (missing street name)
            const partialAddresses = await query(
                `SELECT address, COUNT(*) as count
                 FROM subscribers
                 WHERE circuit_id = $1
                   AND is_active = true
                   AND address ~ '^[0-9\\s]+$'
                 GROUP BY address
                 ORDER BY count DESC`,
                [id]
            );

            // Check total subscriber count
            const totalCount = await query(
                'SELECT COUNT(*) as count FROM subscribers WHERE circuit_id = $1 AND is_active = true',
                [id]
            );

            const total = parseInt(totalCount.rows[0].count);
            const partial = partialAddresses.rows.length;

            if (partial > 0) {
                problemCircuits.push({
                    circuit_id,
                    total,
                    partial,
                    percentage: Math.round((partial / total) * 100)
                });

                console.log(`⚠ ${circuit_id}: ${partial}/${total} addresses are only numbers (${Math.round((partial / total) * 100)}%)`);
                console.log(`   Sample: ${partialAddresses.rows.slice(0, 3).map(r => r.address).join(', ')}`);
            }
        }

        console.log('\n=== Summary ===\n');

        if (problemCircuits.length === 0) {
            console.log('✓ All circuits have properly formatted addresses!');
        } else {
            console.log(`Found ${problemCircuits.length} circuits with address issues:\n`);
            
            problemCircuits.forEach(c => {
                console.log(`  ${c.circuit_id}: ${c.partial}/${c.total} (${c.percentage}%) need fixing`);
            });

            console.log('\nTo fix, run:');
            problemCircuits.forEach(c => {
                console.log(`  npm run reimport:circuit ${c.circuit_id}`);
            });
        }

    } catch (error) {
        logger.error('Check circuits error:', error);
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    checkAllCircuits()
        .then(() => {
            console.log('\n✓ Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

export { checkAllCircuits };
