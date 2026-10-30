import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;
let pgliteInstance = null;
let isUsingPglite = false;

export async function initDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && !databaseUrl.includes('pglite')) {
    logger.info({ mode: 'supabase_postgres' }, 'Connecting to Supabase PostgreSQL database...');
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected database pool error');
    });

    // Test connection
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT NOW() as current_time, version()');
      logger.info({ time: res.rows[0].current_time }, 'Successfully connected to PostgreSQL');
    } finally {
      client.release();
    }
  } else {
    isUsingPglite = true;
    const dataDir = path.resolve(__dirname, '../../data/contextflow_pg');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    logger.info({ mode: 'pglite_local_postgres', path: dataDir }, 'Initializing local persistent PostgreSQL engine (PGlite)...');
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
    logger.info('Local PostgreSQL engine (PGlite) ready.');
  }
}

export async function query(text, params = []) {
  if (!pool && !pgliteInstance) {
    await initDb();
  }

  const start = Date.now();
  try {
    let result;
    if (pool) {
      result = await pool.query(text, params);
    } else {
      result = await pgliteInstance.query(text, params);
    }
    const duration = Date.now() - start;
    logger.debug({ duration, rowCount: result.rowCount }, 'Executed DB query');
    return result;
  } catch (error) {
    logger.error({ error: error.message, query: text }, 'DB query error');
    throw error;
  }
}

export async function getClient() {
  if (!pool && !pgliteInstance) {
    await initDb();
  }

  if (pool) {
    return await pool.connect();
  }
  // PGlite client wrapper
  return {
    query: (text, params) => pgliteInstance.query(text, params),
    release: () => {},
  };
}

export async function transaction(callback) {
  if (!pool && !pgliteInstance) {
    await initDb();
  }

  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    return await pgliteInstance.transaction(async (tx) => {
      return await callback(tx);
    });
  }
}

export async function exec(sql) {
  if (!pool && !pgliteInstance) {
    await initDb();
  }

  const start = Date.now();
  try {
    let result;
    if (pool) {
      result = await pool.query(sql);
    } else {
      result = await pgliteInstance.exec(sql);
    }
    const duration = Date.now() - start;
    logger.debug({ duration }, 'Executed DB exec script');
    return result;
  } catch (error) {
    logger.error({ error: error.message }, 'DB exec error');
    throw error;
  }
}

export default {
  query,
  exec,
  initDb,
  getClient,
  transaction,
  get isPglite() { return isUsingPglite; }
};
