/**
 * GWPL Security — Auth Middleware
 */

const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = getDb().prepare('SELECT id, email, full_name, role, is_active FROM admin_users WHERE id = ?').get(payload.id);
    if (!admin || !admin.is_active) {
      return res.status(401).json({ success: false, error: 'Account inactive or not found.' });
    }
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ success: false, error: 'Not authenticated.' });
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions.' });
    }
    next();
  };
}

function logAction(action, entityType, entityIdFn, detailsFn) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400 && req.admin) {
        try {
          getDb().prepare(`
            INSERT INTO audit_log (admin_id, action, entity_type, entity_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            req.admin.id,
            action,
            entityType || null,
            entityIdFn ? entityIdFn(req, res) : null,
            detailsFn ? JSON.stringify(detailsFn(req)) : null,
            req.ip
          );
        } catch(e) { /* non-fatal */ }
      }
    });
    next();
  };
}

module.exports = { requireAuth, requireRole, logAction };