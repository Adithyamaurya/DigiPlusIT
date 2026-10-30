import { query } from '../config/db.js';
import { logError } from '../utils/logger.js';

export async function getAllUsers(req, res) {
  try {
    const result = await query(`
      SELECT id, name, email, role, avatar_url, created_at
      FROM users
      ORDER BY name ASC;
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'USERS_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve users' });
  }
}

export async function getUserById(req, res) {
  const { id } = req.params;
  try {
    const userRes = await query(`SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = $1`, [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: userRes.rows[0] });
  } catch (err) {
    logError({ requestId: req.id, endpoint: req.originalUrl, errorType: 'USER_FETCH_ERROR', message: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Failed to retrieve user' });
  }
}

