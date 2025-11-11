// Simple Node.js script to fix KP25 data on Heroku
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixKP25Data() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Fixing KP25 subscriber data...\n');

    // Fix 1: Update Wolffintie 18 from "Mustonen Tarja, STF" to "Tammela Penni, HS"
    console.log('1. Updating Wolffintie 18...');
    
    const subscriber18 = await client.query(
      `SELECT id FROM subscribers 
       WHERE circuit_id = 'KP25' 
       AND UPPER(address) LIKE '%WOLFFINTIE 18%'
       AND is_active = true`
    );

    if (subscriber18.rows.length > 0) {
      const subscriberId18 = subscriber18.rows[0].id;
      
      await client.query(
        `UPDATE subscribers 
         SET name = 'Tammela Penni'
         WHERE id = $1`,
        [subscriberId18]
      );
      
      await client.query(
        `DELETE FROM subscriber_products WHERE subscriber_id = $1`,
        [subscriberId18]
      );
      
      await client.query(
        `INSERT INTO subscriber_products (subscriber_id, product_code, quantity)
         VALUES ($1, 'HS', 1)`,
        [subscriberId18]
      );
      
      console.log('   ✓ Updated Wolffintie 18: Tammela Penni, HS');
    } else {
      console.log('   ✗ Wolffintie 18 not found');
    }

    // Fix 2: Update Wolffintie 12 to 11, change to ES product
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
      const newAddress = oldAddress.replace(/12/g, '11');
      
      await client.query(
        `UPDATE subscribers 
         SET address = $1
         WHERE id = $2`,
        [newAddress, subscriberId12]
      );
      
      await client.query(
        `DELETE FROM subscriber_products WHERE subscriber_id = $1`,
        [subscriberId12]
      );
      
      await client.query(
        `INSERT INTO subscriber_products (subscriber_id, product_code, quantity)
         VALUES ($1, 'ES', 1)`,
        [subscriberId12]
      );
      
      console.log(`   ✓ Updated ${oldAddress} → ${newAddress}: Helenius Risto, ES`);
    } else {
      console.log('   ✗ Wolffintie 12 not found');
    }

    await client.query('COMMIT');
    console.log('\n✅ KP25 corrections completed!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixKP25Data().catch(console.error);
