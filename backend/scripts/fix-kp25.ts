import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

async function fixKP25Data() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Fixing KP25 subscriber data...\n');

    // Fix 1: Update Wolffintie 18 from "Mustonen Tarja, STF" to "Tammela Penni, HS"
    console.log('1. Updating Wolffintie 18...');
    
    // First, get the subscriber_id for Wolffintie 18
    const subscriber18 = await client.query(
      `SELECT id FROM subscribers 
       WHERE circuit_id = 'KP25' 
       AND UPPER(address) LIKE '%WOLFFINTIE 18%'
       AND is_active = true`
    );

    if (subscriber18.rows.length > 0) {
      const subscriberId18 = subscriber18.rows[0].id;
      
      // Update subscriber name
      await client.query(
        `UPDATE subscribers 
         SET name = 'Tammela Penni'
         WHERE id = $1`,
        [subscriberId18]
      );
      
      // Delete old products
      await client.query(
        `DELETE FROM subscriber_products WHERE subscriber_id = $1`,
        [subscriberId18]
      );
      
      // Add correct product (HS)
      await client.query(
        `INSERT INTO subscriber_products (subscriber_id, product_code, quantity)
         VALUES ($1, 'HS', 1)`,
        [subscriberId18]
      );
      
      console.log('   ✓ Updated Wolffintie 18: Tammela Penni, HS');
    } else {
      console.log('   ✗ Wolffintie 18 not found in database');
    }

    // Fix 2: Update Wolffintie 12 to Wolffintie 11 and change from "Helenius Risto, STF" to "Helenius Risto, ES"
    console.log('\n2. Updating Wolffintie 12 → 11...');
    
    const subscriber12 = await client.query(
      `SELECT id, address FROM subscribers 
       WHERE circuit_id = 'KP25' 
       AND UPPER(address) LIKE '%WOLFFINTIE 12%'
       AND is_active = true`
    );

    if (subscriber12.rows.length > 0) {
      const subscriberId12 = subscriber12.rows[0].id;
      const oldAddress = subscriber12.rows[0].address;
      
      // Update address from 12 to 11
      const newAddress = oldAddress.replace(/12/g, '11');
      
      await client.query(
        `UPDATE subscribers 
         SET address = $1
         WHERE id = $2`,
        [newAddress, subscriberId12]
      );
      
      // Delete old products
      await client.query(
        `DELETE FROM subscriber_products WHERE subscriber_id = $1`,
        [subscriberId12]
      );
      
      // Add correct product (ES)
      await client.query(
        `INSERT INTO subscriber_products (subscriber_id, product_code, quantity)
         VALUES ($1, 'ES', 1)`,
        [subscriberId12]
      );
      
      console.log(`   ✓ Updated ${oldAddress} → ${newAddress}: Helenius Risto, ES`);
    } else {
      console.log('   ✗ Wolffintie 12 not found in database');
    }

    await client.query('COMMIT');
    console.log('\n✅ KP25 data corrections completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing KP25 data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixKP25Data().catch(console.error);
