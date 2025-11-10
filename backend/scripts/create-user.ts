import bcrypt from 'bcryptjs';
import { query } from '../src/config/database';
import logger from '../src/config/logger';

const createUser = async () => {
    try {
        const username = process.argv[2];
        const password = process.argv[3];
        const role = process.argv[4] || 'driver'; // driver, manager, or admin
        const email = process.argv[5] || `${username}@mailia.fi`;
        const fullName = process.argv[6] || username;

        if (!username || !password) {
            console.error('Usage: npm run create:user <username> <password> [role] [email] [fullName]');
            console.error('Roles: driver, manager, admin');
            process.exit(1);
        }

        logger.info(`Creating ${role} user...`);
        logger.info(`Username: ${username}`);
        logger.info(`Email: ${email}`);

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await query(
            `INSERT INTO users (username, email, password_hash, full_name, role)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (username) 
            DO UPDATE SET 
                email = $2,
                password_hash = $3,
                full_name = $4,
                role = $5,
                updated_at = NOW()
            RETURNING id, username, email, role`,
            [username, email, passwordHash, fullName, role]
        );

        logger.info('User created/updated successfully:');
        logger.info(JSON.stringify(result.rows[0], null, 2));
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to create user:', error);
        process.exit(1);
    }
};

createUser();
