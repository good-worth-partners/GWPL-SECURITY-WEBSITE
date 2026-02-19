/**
 * GWPL Security — Admin Routes
 * POST /api/admin/login
 * GET  /api/admin/me
 * GET  /api/admin/dashboard
 * GET  /api/admin/audit-log
 */

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../db/connection');
const { requireAuth, requireRole, logAction } = require('../middleware/auth');

const router = express.Router();

// ─── POST /api/admin/login ────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  const { email, password } = req.body;
  const db = getDb();
  const admin = db.prepare('SELECT * FROM admin_users WHERE email = ? AND is_active = 1').get(email);

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    // Log failed attempt
    try { db.prepare("INSERT INTO audit_log (action, details, ip_address) VALUES ('FAILED_LOGIN', ?, ?)").run(email, req.ip); } catch(e){}
    return res.status(401).json({ success: false, error: 'Invalid credentials.' });
  }

  // Update last login
  db.prepare('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = ?').run(admin.id);

  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  try { db.prepare("INSERT INTO audit_log (admin_id, action, ip_address) VALUES (?, 'LOGIN', ?)").run(admin.id, req.ip); } catch(e){}

  res.json({
    success: true,
    token,
    admin: { id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role }
  });
});

// ─── GET /api/admin/me ────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: req.admin });
});

// ─── GET /api/admin/dashboard — Unified stats ─────────
router.get('/dashboard', requireAuth, (req, res) => {
  const db = getDb();

  const auditStats = {
    total:    db.prepare('SELECT COUNT(*) as c FROM audit_submissions').get().c,
    new:      db.prepare("SELECT COUNT(*) as c FROM audit_submissions WHERE status='new'").get().c,
    critical: db.prepare("SELECT COUNT(*) as c FROM audit_submissions WHERE threat_level='critical' AND status NOT IN ('resolved','closed')").get().c,
    today:    db.prepare("SELECT COUNT(*) as c FROM audit_submissions WHERE date(submitted_at)=date('now')").get().c,
    this_week:db.prepare("SELECT COUNT(*) as c FROM audit_submissions WHERE submitted_at>=datetime('now','-7 days')").get().c,
    by_threat:db.prepare("SELECT threat_level, COUNT(*) as c FROM audit_submissions GROUP BY threat_level ORDER BY c DESC").all(),
    by_status:db.prepare("SELECT status, COUNT(*) as c FROM audit_submissions GROUP BY status ORDER BY c DESC").all(),
    by_sector:db.prepare("SELECT state_region, COUNT(*) as c FROM audit_submissions WHERE state_region IS NOT NULL GROUP BY state_region ORDER BY c DESC LIMIT 10").all(),
  };

  const careerStats = {
    total:       db.prepare('SELECT COUNT(*) as c FROM career_applications').get().c,
    new:         db.prepare("SELECT COUNT(*) as c FROM career_applications WHERE status='new'").get().c,
    by_position: db.prepare("SELECT position_code, position_applied, COUNT(*) as c FROM career_applications GROUP BY position_code ORDER BY c DESC").all(),
    this_week:   db.prepare("SELECT COUNT(*) as c FROM career_applications WHERE submitted_at>=datetime('now','-7 days')").get().c,
  };

  const recentAudit = db.prepare(`
    SELECT reference_number, threat_level, status, organisation_name,
           first_name || ' ' || last_name as contact, submitted_at
    FROM audit_submissions ORDER BY submitted_at DESC LIMIT 8
  `).all();

  const recentCareers = db.prepare(`
    SELECT reference_number, position_applied, status,
           first_name || ' ' || last_name as applicant, submitted_at
    FROM career_applications ORDER BY submitted_at DESC LIMIT 8
  `).all();

  const attachmentCount = db.prepare('SELECT COUNT(*) as c FROM attachments').get().c;
  const emailCount      = db.prepare('SELECT COUNT(*) as c FROM email_log').get().c;

  res.json({
    success: true,
    data: {
      audit:        auditStats,
      careers:      careerStats,
      recent_audit: recentAudit,
      recent_careers: recentCareers,
      attachments:  attachmentCount,
      emails_sent:  emailCount,
    }
  });
});

// ─── GET /api/admin/audit-log ─────────────────────────
router.get('/audit-log', requireAuth, requireRole('superadmin', 'admin'), (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const db = getDb();
  const rows = db.prepare(`
    SELECT l.*, a.full_name as admin_name, a.email as admin_email
    FROM audit_log l
    LEFT JOIN admin_users a ON l.admin_id = a.id
    ORDER BY l.timestamp DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM audit_log').get().c;
  res.json({ success: true, total, data: rows });
});

// ─── POST /api/admin/users — Create admin user ────────
router.post('/users',
  requireAuth, requireRole('superadmin'),
  logAction('CREATE_ADMIN_USER', 'admin_user'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 10 }),
    body('full_name').trim().notEmpty(),
    body('role').isIn(['admin', 'analyst', 'viewer']),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
    const { email, password, full_name, role } = req.body;
    const hash = bcrypt.hashSync(password, 12);
    const { v4: uuidv4 } = require('uuid');
    try {
      getDb().prepare('INSERT INTO admin_users (id, email, password_hash, full_name, role) VALUES (?,?,?,?,?)')
        .run(uuidv4(), email, hash, full_name, role);
      res.status(201).json({ success: true, message: 'Admin user created.' });
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ success: false, error: 'Email already exists.' });
      throw e;
    }
  }
);

// ─── GET /api/admin/users ─────────────────────────────
router.get('/users', requireAuth, requireRole('superadmin', 'admin'), (req, res) => {
  const users = getDb().prepare('SELECT id, email, full_name, role, is_active, created_at, last_login, login_count FROM admin_users ORDER BY created_at ASC').all();
  res.json({ success: true, data: users });
});

// ─── PATCH /api/admin/users/:id ───────────────────────
router.patch('/users/:id', requireAuth, requireRole('superadmin'),
  logAction('UPDATE_ADMIN_USER', 'admin_user', req => req.params.id),
  (req, res) => {
    const { is_active, role } = req.body;
    const db = getDb();
    if (is_active !== undefined) db.prepare('UPDATE admin_users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
    if (role) db.prepare('UPDATE admin_users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.json({ success: true, message: 'Updated.' });
  }
);

module.exports = router;