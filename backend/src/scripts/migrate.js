import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { exec, initDb } from '../config/db.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function runMigrations() {
  logger.info('Starting database migrations...');
  await initDb();

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const migrationFile = path.join(migrationsDir, file);
    logger.info({ file }, `Applying migration: ${file}`);
    const sql = fs.readFileSync(migrationFile, 'utf-8');
    try {
      await exec(sql);
      logger.info({ file }, `Applied migration: ${file}`);
    } catch (error) {
      logger.error({ file, error: error.message }, 'Migration step failed!');
      throw error;
    }
  }

  logger.info('All database schema migrations completed successfully!');
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      logger.info('Migration finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error(err, 'Migration script error');
      process.exit(1);
    });
}
