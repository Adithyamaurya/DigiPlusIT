import app from '../backend/src/app.js';
import { ensureDbInitialized } from '../backend/src/config/db.js';

let isReady = false;
let initPromise = null;

export default async function handler(req, res) {
  if (!isReady) {
    if (!initPromise) {
      initPromise = ensureDbInitialized()
        .then(() => {
          isReady = true;
        })
        .catch((err) => {
          console.error('Database initialization error in serverless handler:', err);
          isReady = true;
        });
    }
    await initPromise;
  }

  return new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    res.on('error', reject);
    app(req, res);
  });
}
