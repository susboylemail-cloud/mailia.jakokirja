import { importAllCSVFiles } from '../src/services/csvImport';
import path from 'path';
import logger from '../src/config/logger';

const rootDir = path.join(__dirname, '../../');

logger.info('Starting CSV import from root directory...');
logger.info(`Root directory: ${rootDir}`);

importAllCSVFiles(rootDir)
    .then(() => {
        logger.info('CSV import completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('CSV import failed:', error);
        process.exit(1);
    });
