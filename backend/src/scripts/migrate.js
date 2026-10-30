import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { exec, initDb } from '../config/db.js';
import logger from '../utils/logger.js';
import { MIGRATIONS } from './migrationsData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function runMigrations() {
  logger.info('Starting database migrations...');
  await initDb();

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  let migrationItems = [];

  if (fs.existsSync(migrationsDir)) {
    try {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        migrationItems.push({ name: file, sql });
      }
    } catch (e) {
      logger.warn({ err: e.message }, 'Could not read migrations directory, using embedded migrations');
    }
  }

  // Fallback to embedded migrations if no files found on disk
  if (migrationItems.length === 0) {
    migrationItems = MIGRATIONS;
  }

  for (const item of migrationItems) {
    logger.info({ file: item.name }, `Applying migration: ${item.name}`);
    try {
      await exec(item.sql);
      logger.info({ file: item.name }, `Applied migration: ${item.name}`);
    } catch (error) {
      logger.error({ file: item.name, error: error.message }, 'Migration step failed!');
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
