require('dotenv').config();
const { db } = require('./connection');
const bcrypt = require('bcryptjs');

console.log('🛠  Initialising GWPL Security database...\n');

db.serialize(() => {

  db.run(`CREATE TABLE IF NOT EXISTS audit_submissions (
    id TEXT PRIMARY KEY,
    reference_number TEXT UNIQUE NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    job_title TEXT,
    clearance_level TEXT,
    phone_primary TEXT NOT NULL,
    phone_alternate TEXT,
    email TEXT NOT NULL,
    contact_preference TEXT DEFAULT 'both',
    organisation_name TEXT NOT NULL,
    organisation_type TEXT,
    state_region TEXT,
    site_location TEXT,
    sectors TEXT,
    asset_value_range TEXT,
    existing_provider TEXT,
    threat_level TEXT,
    threat_type TEXT,
    incident_datetime TEXT,
    authorities_notified TEXT,
    threat_actors TEXT,
    situation_summary TEXT,
    estimated_impact TEXT,
    services_required TEXT,
    desired_start_date TEXT,
    contract_duration TEXT,
    budget_range TEXT,
    additional_notes TEXT,
    ip_address TEXT,
    user_agent TEXT,
    acknowledged_at DATETIME,
    acknowledged_by TEXT,
    resolved_at DATETIME,
    internal_notes TEXT,
    assigned_to TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    submission_type TEXT DEFAULT 'audit',
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS career_applications (
    id TEXT PRIMARY KEY,
    reference_number TEXT UNIQUE NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    date_of_birth TEXT,
    state_of_origin TEXT,
    current_location TEXT,
    position_applied TEXT NOT NULL,
    position_code TEXT,
    highest_education TEXT,
    years_experience INTEGER,
    military_background INTEGER DEFAULT 0,
    military_branch TEXT,
    military_rank TEXT,
    military_years INTEGER,
    certifications TEXT,
    languages TEXT,
    cover_letter TEXT,
    linkedin_url TEXT,
    referral_source TEXT,
    ip_address TEXT,
    user_agent TEXT,
    interviewed_at DATETIME,
    hired_at DATETIME,
    internal_notes TEXT,
    assigned_to TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'analyst',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    login_count INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    admin_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS email_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    template TEXT,
    entity_type TEXT,
    entity_id TEXT,
    status TEXT DEFAULT 'sent',
    error_message TEXT
  )`);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_submissions(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_threat ON audit_submissions(threat_level)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_careers_status ON career_applications(status)`);

  // Seed admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gwplsecurity.com';
  const adminPass  = process.env.ADMIN_PASSWORD || 'Admin@Local2025';

  db.get('SELECT id FROM admin_users WHERE email = ?', [adminEmail], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync(adminPass, 12);
      const id   = require('crypto').randomUUID();
      db.run(
        'INSERT INTO admin_users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [id, adminEmail, hash, 'GWPL Administrator', 'superadmin'],
        () => {
          console.log('✅ Admin user created');
          console.log(`   Email:    ${adminEmail}`);
          console.log(`   Password: ${adminPass}`);
          console.log('\n✅ Database ready!\n');
          db.close();
        }
      );
    } else {
      console.log('ℹ️  Admin already exists\n✅ Database ready!\n');
      db.close();
    }
  });
});