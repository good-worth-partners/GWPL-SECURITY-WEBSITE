/**
 * GWPL Security — Audit Submission Routes
 * POST /api/audit/submit
 * GET  /api/audit/:id/status  (public ref lookup)
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb }  = require('../db/connection');
const mailer     = require('../config/mailer');
const { requireAuth, requireRole, logAction } = require('../middleware/auth');

const router = express.Router();

// ─── File Upload Config ───────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `audit_${Date.now()}_${uuidv4().slice(0,8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.UPLOAD_MAX_SIZE_MB) || 20) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|jpg|jpeg|png|gif|xlsx|xls/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  },
});

// ─── Reference Number Generator ──────────────────────
function generateRef() {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `GWPL-${year}-${rand}`;
}

// ─── Validation Rules ─────────────────────────────────
const submitValidation = [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone_primary').trim().notEmpty().withMessage('Phone number is required'),
  body('organisation_name').trim().notEmpty().withMessage('Organisation name is required'),
  body('situation_summary').trim().isLength({ min: 20 }).withMessage('Please provide a summary of at least 20 characters'),
];

// ─── POST /api/audit/submit ───────────────────────────
router.post('/submit', upload.array('attachments', 10), submitValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const db = getDb();
  const id  = uuidv4();
  const ref = generateRef();

  try {
    const sub = {
      id,
      reference_number:   ref,
      first_name:         req.body.first_name,
      last_name:          req.body.last_name,
      job_title:          req.body.job_title || null,
      clearance_level:    req.body.clearance_level || null,
      phone_primary:      req.body.phone_primary,
      phone_alternate:    req.body.phone_alternate || null,
      email:              req.body.email,
      contact_preference: req.body.contact_preference || 'both',
      organisation_name:  req.body.organisation_name,
      organisation_type:  req.body.organisation_type || null,
      state_region:       req.body.state_region || null,
      site_location:      req.body.site_location || null,
      sectors:            JSON.stringify(req.body.sectors || []),
      asset_value_range:  req.body.asset_value_range || null,
      existing_provider:  req.body.existing_provider || null,
      threat_level:       req.body.threat_level || 'routine',
      threat_type:        req.body.threat_type || null,
      incident_datetime:  req.body.incident_datetime || null,
      authorities_notified: req.body.authorities_notified || null,
      threat_actors:      JSON.stringify(req.body.threat_actors || []),
      situation_summary:  req.body.situation_summary,
      estimated_impact:   req.body.estimated_impact || null,
      services_required:  JSON.stringify(req.body.services_required || []),
      desired_start_date: req.body.desired_start_date || null,
      contract_duration:  req.body.contract_duration || null,
      budget_range:       req.body.budget_range || null,
      additional_notes:   req.body.additional_notes || null,
      ip_address:         req.ip,
      user_agent:         req.headers['user-agent'] || null,
    };

    // Insert submission
    db.prepare(`
      INSERT INTO audit_submissions (
        id, reference_number, first_name, last_name, job_title, clearance_level,
        phone_primary, phone_alternate, email, contact_preference,
        organisation_name, organisation_type, state_region, site_location,
        sectors, asset_value_range, existing_provider,
        threat_level, threat_type, incident_datetime, authorities_notified,
        threat_actors, situation_summary, estimated_impact,
        services_required, desired_start_date, contract_duration,
        budget_range, additional_notes, ip_address, user_agent
      ) VALUES (
        @id, @reference_number, @first_name, @last_name, @job_title, @clearance_level,
        @phone_primary, @phone_alternate, @email, @contact_preference,
        @organisation_name, @organisation_type, @state_region, @site_location,
        @sectors, @asset_value_range, @existing_provider,
        @threat_level, @threat_type, @incident_datetime, @authorities_notified,
        @threat_actors, @situation_summary, @estimated_impact,
        @services_required, @desired_start_date, @contract_duration,
        @budget_range, @additional_notes, @ip_address, @user_agent
      )
    `).run(sub);

    // Insert file attachments
    if (req.files && req.files.length > 0) {
      const insertFile = db.prepare(`
        INSERT INTO attachments (id, submission_id, submission_type, original_name, stored_name, mime_type, size_bytes)
        VALUES (?, ?, 'audit', ?, ?, ?, ?)
      `);
      for (const file of req.files) {
        insertFile.run(uuidv4(), id, file.originalname, file.filename, file.mimetype, file.size);
      }
    }

    // Fire emails (non-blocking)
    mailer.sendSubmitterAck(sub).catch(console.error);
    mailer.sendGsocAlert(sub).catch(console.error);

    return res.status(201).json({
      success: true,
      reference_number: ref,
      message: 'Your emergency audit request has been received. Acknowledgement will follow within 2 hours.',
    });

  } catch (err) {
    console.error('[AUDIT SUBMIT ERROR]', err);
    return res.status(500).json({ success: false, error: 'Submission failed. Please call our emergency hotline.' });
  }
});

// ─── GET /api/audit/:ref/status — Public Reference Lookup ──
router.get('/:ref/status', (req, res) => {
  const sub = getDb().prepare(`
    SELECT reference_number, status, submitted_at, threat_level,
           first_name, organisation_name, acknowledged_at
    FROM audit_submissions WHERE reference_number = ?
  `).get(req.params.ref.toUpperCase());

  if (!sub) return res.status(404).json({ success: false, error: 'Reference not found.' });

  return res.json({
    success: true,
    data: {
      reference_number: sub.reference_number,
      status:           sub.status,
      submitted_at:     sub.submitted_at,
      acknowledged_at:  sub.acknowledged_at,
    }
  });
});

// ─── ADMIN: GET /api/audit/submissions (paginated) ────
router.get('/submissions', requireAuth, (req, res) => {
  const { page = 1, limit = 20, status, threat_level, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '1=1';
  const params = [];
  if (status)       { where += ' AND status = ?';        params.push(status); }
  if (threat_level) { where += ' AND threat_level = ?';  params.push(threat_level); }
  if (search) {
    where += ' AND (first_name LIKE ? OR last_name LIKE ? OR organisation_name LIKE ? OR reference_number LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM audit_submissions WHERE ${where}`).get(...params).cnt;
  const rows  = db.prepare(`
    SELECT id, reference_number, status, threat_level, submitted_at, acknowledged_at,
           first_name, last_name, job_title, organisation_name, phone_primary, email,
           state_region, threat_type, assigned_to
    FROM audit_submissions WHERE ${where}
    ORDER BY submitted_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / limit), data: rows });
});

// ─── ADMIN: GET /api/audit/:id — Full submission ──────
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const sub = db.prepare('SELECT * FROM audit_submissions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ success: false, error: 'Not found.' });

  const files = db.prepare('SELECT * FROM attachments WHERE submission_id = ?').all(req.params.id);
  sub.attachments = files;
  sub.sectors = JSON.parse(sub.sectors || '[]');
  sub.threat_actors = JSON.parse(sub.threat_actors || '[]');
  sub.services_required = JSON.parse(sub.services_required || '[]');

  res.json({ success: true, data: sub });
});

// ─── ADMIN: PATCH /api/audit/:id — Update status / notes ──
router.patch('/:id',
  requireAuth,
  requireRole('superadmin', 'admin', 'analyst'),
  logAction('UPDATE_AUDIT', 'audit', req => req.params.id),
  (req, res) => {
    const allowed = ['status', 'assigned_to', 'internal_notes', 'acknowledged_at', 'resolved_at'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update.' });
    }

    const sets = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    const db = getDb();
    const result = db.prepare(`UPDATE audit_submissions SET ${sets} WHERE id = @id`)
      .run({ ...updates, id: req.params.id });

    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    res.json({ success: true, message: 'Updated successfully.' });
  }
);

// ─── ADMIN: GET /api/audit/stats/summary ─────────────
router.get('/stats/summary', requireAuth, (req, res) => {
  const db = getDb();
  const stats = {
    total:     db.prepare('SELECT COUNT(*) as c FROM audit_submissions').get().c,
    new:       db.prepare("SELECT COUNT(*) as c FROM audit_submissions WHERE status='new'").get().c,
    critical:  db.prepare("SELECT COUNT(*) as c FROM audit_submissions WHERE threat_level='critical'").get().c,
    high:      db.prepare("SELECT COUNT(*) as c FROM audit_submissions WHERE threat_level='high'").get().c,
    today:     db.prepare("SELECT COUNT(*) as c FROM audit_submissions WHERE date(submitted_at)=date('now')").get().c,
    by_status: db.prepare("SELECT status, COUNT(*) as c FROM audit_submissions GROUP BY status").all(),
    by_threat: db.prepare("SELECT threat_level, COUNT(*) as c FROM audit_submissions GROUP BY threat_level").all(),
    recent:    db.prepare("SELECT reference_number,threat_level,status,organisation_name,submitted_at FROM audit_submissions ORDER BY submitted_at DESC LIMIT 5").all(),
  };
  res.json({ success: true, data: stats });
});

module.exports = router;