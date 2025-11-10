import bcrypt from 'bcryptjs';
import { query } from '../src/config/database';
import logger from '../src/config/logger';

const createAdminUser = async () => {
    try {
        const username = process.argv[2] || 'admin';
        const password = process.argv[3] || 'admin123';
        const email = process.argv[4] || `${username}@mailia.fi`;
        const fullName = process.argv[5] || 'System Administrator';

        logger.info('Creating admin user...');
        logger.info(`Username: ${username}`);
        logger.info(`Email: ${email}`);

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users (username, email, password_hash, full_name, role)
            VALUES ($1, $2, $3, $4, 'admin')
            ON CONFLICT (username) 
            DO UPDATE SET 
                email = $2,
                password_hash = $3,
                full_name = $4,
                updated_at = NOW()
            RETURNING id, username, email, role`,
            [username, email, passwordHash, fullName]
        );

        logger.info('Admin user created successfully:');
        logger.info(JSON.stringify(result.rows[0], null, 2));
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to create admin user:', error);
        process.exit(1);
    }
};

createAdminUser();
