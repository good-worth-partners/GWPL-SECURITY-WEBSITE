/**
 * GWPL Security — Careers Application Routes
 * POST /api/careers/apply
 * GET  /api/careers/applications (admin)
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

const POSITIONS = {
  'gsoc-operator':   { title: 'GSOC Surveillance Operator',              code: 'GSO', vacancies: 12 },
  'rrt-lead':        { title: 'Rapid Response Team (RRT) Lead',          code: 'RRT', vacancies: 6  },
  'k9-handler':      { title: 'K-9 Tactical Handler (DH 4 Certified)',   code: 'K9H', vacancies: 4  },
  'infra-analyst':   { title: 'Strategic Infrastructure Analyst',        code: 'SIA', vacancies: 4  },
};

// ─── File Upload ──────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cv_${Date.now()}_${uuidv4().slice(0,8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for CVs
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  },
});

function generateRef() {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `GWPL-HR-${year}-${rand}`;
}

// ─── GET /api/careers/positions — List open roles ────
router.get('/positions', (req, res) => {
  res.json({ success: true, data: Object.entries(POSITIONS).map(([key, val]) => ({ key, ...val })) });
});

// ─── POST /api/careers/apply ──────────────────────────
const applyValidation = [
  body('first_name').trim().notEmpty(),
  body('last_name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('phone').trim().notEmpty(),
  body('position_key').isIn(Object.keys(POSITIONS)).withMessage('Invalid position selected'),
];

router.post('/apply', upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'certifications_docs', maxCount: 5 },
]), applyValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const db = getDb();
  const id  = uuidv4();
  const ref = generateRef();
  const pos = POSITIONS[req.body.position_key];

  try {
    const app = {
      id,
      reference_number:    ref,
      first_name:          req.body.first_name,
      last_name:           req.body.last_name,
      email:               req.body.email,
      phone:               req.body.phone,
      date_of_birth:       req.body.date_of_birth || null,
      state_of_origin:     req.body.state_of_origin || null,
      current_location:    req.body.current_location || null,
      position_applied:    pos.title,
      position_code:       pos.code,
      highest_education:   req.body.highest_education || null,
      years_experience:    parseInt(req.body.years_experience) || 0,
      military_background: req.body.military_background === 'true' ? 1 : 0,
      military_branch:     req.body.military_branch || null,
      military_rank:       req.body.military_rank || null,
      military_years:      parseInt(req.body.military_years) || null,
      certifications:      JSON.stringify(req.body.certifications || []),
      languages:           JSON.stringify(req.body.languages || []),
      cover_letter:        req.body.cover_letter || null,
      linkedin_url:        req.body.linkedin_url || null,
      referral_source:     req.body.referral_source || null,
      ip_address:          req.ip,
      user_agent:          req.headers['user-agent'] || null,
    };

    db.prepare(`
      INSERT INTO career_applications (
        id, reference_number, first_name, last_name, email, phone,
        date_of_birth, state_of_origin, current_location,
        position_applied, position_code, highest_education,
        years_experience, military_background, military_branch,
        military_rank, military_years, certifications, languages,
        cover_letter, linkedin_url, referral_source, ip_address, user_agent
      ) VALUES (
        @id, @reference_number, @first_name, @last_name, @email, @phone,
        @date_of_birth, @state_of_origin, @current_location,
        @position_applied, @position_code, @highest_education,
        @years_experience, @military_background, @military_branch,
        @military_rank, @military_years, @certifications, @languages,
        @cover_letter, @linkedin_url, @referral_source, @ip_address, @user_agent
      )
    `).run(app);

    // Save uploaded files
    const insertFile = db.prepare(`
      INSERT INTO attachments (id, submission_id, submission_type, original_name, stored_name, mime_type, size_bytes)
      VALUES (?, ?, 'careers', ?, ?, ?, ?)
    `);
    if (req.files?.cv?.[0]) {
      const f = req.files.cv[0];
      insertFile.run(uuidv4(), id, f.originalname, f.filename, f.mimetype, f.size);
    }
    if (req.files?.certifications_docs) {
      for (const f of req.files.certifications_docs) {
        insertFile.run(uuidv4(), id, f.originalname, f.filename, f.mimetype, f.size);
      }
    }

    // Emails (non-blocking)
    mailer.sendCareerConfirm(app).catch(console.error);
    mailer.sendHrAlert(app).catch(console.error);

    return res.status(201).json({
      success: true,
      reference_number: ref,
      position: pos.title,
      message: 'Application received. Our recruitment board will be in touch within 5–7 working days.',
    });

  } catch (err) {
    console.error('[CAREERS APPLY ERROR]', err);
    return res.status(500).json({ success: false, error: 'Application failed. Please email hr@gwplsecurity.com directly.' });
  }
});

// ─── ADMIN: GET /api/careers/applications ─────────────
router.get('/applications', requireAuth, (req, res) => {
  const { page = 1, limit = 20, status, position_code, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '1=1';
  const params = [];
  if (status)        { where += ' AND status = ?';        params.push(status); }
  if (position_code) { where += ' AND position_code = ?'; params.push(position_code); }
  if (search) {
    where += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR reference_number LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM career_applications WHERE ${where}`).get(...params).cnt;
  const rows  = db.prepare(`
    SELECT id, reference_number, status, submitted_at, first_name, last_name,
           email, phone, position_applied, position_code, years_experience,
           military_background, state_of_origin, assigned_to
    FROM career_applications WHERE ${where}
    ORDER BY submitted_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / limit), data: rows });
});

// ─── ADMIN: GET /api/careers/:id — Full application ───
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const app = db.prepare('SELECT * FROM career_applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ success: false, error: 'Not found.' });
  const files = db.prepare("SELECT * FROM attachments WHERE submission_id = ? AND submission_type='careers'").all(req.params.id);
  app.attachments = files;
  app.certifications = JSON.parse(app.certifications || '[]');
  app.languages = JSON.parse(app.languages || '[]');
  res.json({ success: true, data: app });
});

// ─── ADMIN: PATCH /api/careers/:id ────────────────────
router.patch('/:id', requireAuth, requireRole('superadmin', 'admin', 'analyst'),
  logAction('UPDATE_APPLICATION', 'careers', req => req.params.id),
  (req, res) => {
    const allowed = ['status', 'assigned_to', 'internal_notes', 'interviewed_at', 'hired_at'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, error: 'No valid fields.' });
    const sets = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    const result = getDb().prepare(`UPDATE career_applications SET ${sets} WHERE id = @id`).run({ ...updates, id: req.params.id });
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Not found.' });
    res.json({ success: true, message: 'Updated.' });
  }
);

// ─── ADMIN: Stats ─────────────────────────────────────
router.get('/stats/summary', requireAuth, (req, res) => {
  const db = getDb();
  res.json({ success: true, data: {
    total:        db.prepare('SELECT COUNT(*) as c FROM career_applications').get().c,
    new:          db.prepare("SELECT COUNT(*) as c FROM career_applications WHERE status='new'").get().c,
    by_position:  db.prepare("SELECT position_code, position_applied, COUNT(*) as c FROM career_applications GROUP BY position_code").all(),
    by_status:    db.prepare("SELECT status, COUNT(*) as c FROM career_applications GROUP BY status").all(),
    this_week:    db.prepare("SELECT COUNT(*) as c FROM career_applications WHERE submitted_at >= datetime('now','-7 days')").get().c,
  }});
});

module.exports = router;