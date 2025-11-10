import { importAllCSVFiles } from '../src/services/csvImport';
import path from 'path';
import logger from '../src/config/logger';

const rootDir = path.join(__dirname, '../../');

console.log('=== Starting CSV import ===');
console.log(`Root directory: ${rootDir}`);

logger.info('Starting CSV import from root directory...');
logger.info(`Root directory: ${rootDir}`);

importAllCSVFiles(rootDir)
    .then(() => {
        console.log('=== CSV import completed successfully ===');
        logger.info('CSV import completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('=== CSV import failed ===');
        console.error(error);
        logger.error('CSV import failed:', error);
        process.exit(1);
    });
