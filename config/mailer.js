/**
 * GWPL Security — Email Notification Service
 */

const nodemailer = require('nodemailer');
const { getDb } = require('../db/connection');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Log email to DB ─────────────────────────────────
function logEmail({ recipient, subject, template, entityType, entityId, status, error }) {
  try {
    getDb().prepare(`
      INSERT INTO email_log (recipient, subject, template, entity_type, entity_id, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(recipient, subject, template || null, entityType || null, entityId || null, status, error || null);
  } catch (e) { console.error('Email log error:', e.message); }
}

// ─── Send helper ─────────────────────────────────────
async function send({ to, subject, html, template, entityType, entityId }) {
  try {
    await transporter.sendMail({
      from: `"GWPL Security GSOC" <${process.env.SMTP_USER}>`,
      to, subject, html,
    });
    logEmail({ recipient: to, subject, template, entityType, entityId, status: 'sent' });
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR]', err.message);
    logEmail({ recipient: to, subject, template, entityType, entityId, status: 'failed', error: err.message });
    return false;
  }
}

// ─── TEMPLATES ───────────────────────────────────────

const brandBar = `
  <div style="background:#0d0d0d;padding:16px 32px;border-bottom:3px solid #c9a84c;">
    <span style="font-family:Montserrat,sans-serif;font-weight:900;font-size:1.1rem;color:#f5f5f5;letter-spacing:0.1em;">
      GWPL <span style="color:#c9a84c">SECURITY</span>
    </span>
  </div>`;

const footer = `
  <div style="background:#0a0a0a;padding:20px 32px;border-top:1px solid #222;margin-top:32px;">
    <p style="font-family:sans-serif;font-size:0.72rem;color:#555;margin:0;">
      This communication is classified and intended solely for the named recipient. GWPL Security — A Goodworths Partners subsidiary.
    </p>
  </div>`;

// ── 1. GSOC Alert: New Critical/High Submission ──────
function gsocAlertHtml(sub) {
  const threatColor = { critical: '#e74c3c', high: '#e67e22', elevated: '#f1c40f', routine: '#2ecc71' };
  const color = threatColor[sub.threat_level] || '#c9a84c';
  return `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#111;border:1px solid #222;">
      ${brandBar}
      <div style="padding:28px 32px;">
        <div style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.4);border-radius:4px;padding:12px 16px;margin-bottom:24px;">
          <span style="font-size:0.65rem;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;color:#e74c3c;">
            ⚡ NEW ${(sub.threat_level || 'ROUTINE').toUpperCase()} THREAT SUBMISSION
          </span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem;color:#ccc;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888;width:40%">Reference</td>
              <td style="padding:10px 0;border-bottom:1px solid #222;color:#c9a84c;font-weight:700">${sub.reference_number}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Threat Level</td>
              <td style="padding:10px 0;border-bottom:1px solid #222;color:${color};font-weight:700;text-transform:uppercase">${sub.threat_level || 'N/A'}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Contact</td>
              <td style="padding:10px 0;border-bottom:1px solid #222">${sub.first_name} ${sub.last_name} — ${sub.job_title || ''}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Organisation</td>
              <td style="padding:10px 0;border-bottom:1px solid #222">${sub.organisation_name}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Phone</td>
              <td style="padding:10px 0;border-bottom:1px solid #222">${sub.phone_primary}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #222">${sub.email}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Threat Type</td>
              <td style="padding:10px 0;border-bottom:1px solid #222">${sub.threat_type || 'N/A'}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Location</td>
              <td style="padding:10px 0;border-bottom:1px solid #222">${sub.state_region || ''} ${sub.site_location ? '— ' + sub.site_location : ''}</td></tr>
          <tr><td style="padding:10px 0;color:#888">Summary</td>
              <td style="padding:10px 0">${sub.situation_summary || 'See admin dashboard'}</td></tr>
        </table>
        <div style="margin-top:28px;">
          <a href="${process.env.BASE_URL}/admin" style="background:#c9a84c;color:#0d0d0d;font-weight:800;font-size:0.78rem;letter-spacing:0.2em;text-transform:uppercase;padding:14px 28px;text-decoration:none;display:inline-block;">
            VIEW IN ADMIN DASHBOARD →
          </a>
        </div>
      </div>
      ${footer}
    </div>`;
}

// ── 2. Submitter Acknowledgement ──────────────────────
function submitterAckHtml(sub) {
  return `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#111;border:1px solid #222;">
      ${brandBar}
      <div style="padding:28px 32px;">
        <h2 style="color:#f5f5f5;font-size:1.2rem;margin-bottom:8px;">Your request has been received.</h2>
        <p style="color:#999;line-height:1.8;margin-bottom:24px;">
          Dear ${sub.first_name},<br><br>
          Your Emergency Security Audit Request has been securely transmitted to our GSOC Duty Officer and will be treated as classified. A member of our team will contact you within the timeframes below.
        </p>
        <div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:6px;padding:20px 24px;margin-bottom:24px;">
          <p style="font-size:0.62rem;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;color:#c9a84c;margin:0 0 12px;">Your Reference Number</p>
          <p style="font-size:1.5rem;font-weight:900;color:#f5f5f5;letter-spacing:0.15em;margin:0;">${sub.reference_number}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;color:#ccc;margin-bottom:24px;">
          <tr style="background:rgba(255,255,255,0.03)">
            <td style="padding:10px 14px;border:1px solid #222">Acknowledgement</td>
            <td style="padding:10px 14px;border:1px solid #222;color:#c9a84c;font-weight:700">Within 2 hours</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border:1px solid #222">Preliminary Call</td>
            <td style="padding:10px 14px;border:1px solid #222;color:#c9a84c;font-weight:700">Within 4 hours</td>
          </tr>
          <tr style="background:rgba(255,255,255,0.03)">
            <td style="padding:10px 14px;border:1px solid #222">Field Assessment</td>
            <td style="padding:10px 14px;border:1px solid #222;color:#c9a84c;font-weight:700">Within 24 hours</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border:1px solid #222">Full Written Report</td>
            <td style="padding:10px 14px;border:1px solid #222;color:#c9a84c;font-weight:700">Within 72 hours</td>
          </tr>
        </table>
        <p style="color:#777;font-size:0.82rem;line-height:1.7;">
          For urgent situations, contact our GSOC Emergency Hotline directly:<br>
          <strong style="color:#f5f5f5">+234 800 GWPL SEC</strong> (24/7 — answered within 2 rings)
        </p>
      </div>
      ${footer}
    </div>`;
}

// ── 3. Career Application Confirmation ───────────────
function careerConfirmHtml(app) {
  return `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#111;border:1px solid #222;">
      ${brandBar}
      <div style="padding:28px 32px;">
        <h2 style="color:#f5f5f5;font-size:1.2rem;margin-bottom:8px;">Application Received — The Road to GOLD Begins.</h2>
        <p style="color:#999;line-height:1.8;margin-bottom:24px;">
          Dear ${app.first_name},<br><br>
          Thank you for applying to join GWPL Security. Your application for <strong style="color:#c9a84c">${app.position_applied}</strong> has been received and assigned to our GWPL-GOLD Recruitment Board for review.
        </p>
        <div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:6px;padding:20px 24px;margin-bottom:24px;">
          <p style="font-size:0.62rem;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;color:#c9a84c;margin:0 0 8px;">Application Reference</p>
          <p style="font-size:1.3rem;font-weight:900;color:#f5f5f5;letter-spacing:0.15em;margin:0;">${app.reference_number}</p>
        </div>
        <p style="color:#777;font-size:0.85rem;line-height:1.8;">
          Our recruitment process: <strong style="color:#aaa">Application → Assessment → Gold Intake → Deployment</strong><br><br>
          We will be in touch within 5–7 working days if your profile meets our requirements. Please keep your phone <strong style="color:#f5f5f5">${app.phone}</strong> available.
        </p>
      </div>
      ${footer}
    </div>`;
}

// ── 4. HR Alert: New Career Application ──────────────
function hrAlertHtml(app) {
  return `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#111;border:1px solid #222;">
      ${brandBar}
      <div style="padding:28px 32px;">
        <p style="font-size:0.65rem;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;color:#c9a84c;margin-bottom:16px;">📋 New Career Application</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem;color:#ccc;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888;width:40%">Reference</td>
              <td style="padding:10px 0;border-bottom:1px solid #222;color:#c9a84c">${app.reference_number}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Applicant</td>
              <td style="padding:10px 0;border-bottom:1px solid #222">${app.first_name} ${app.last_name}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Position</td>
              <td style="padding:10px 0;border-bottom:1px solid #222">${app.position_applied}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #222">${app.email}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:#888">Phone</td>
              <td style="padding:10px 0;border-bottom:1px solid #222">${app.phone}</td></tr>
          <tr><td style="padding:10px 0;color:#888">Military Background</td>
              <td style="padding:10px 0">${app.military_background ? 'Yes — ' + (app.military_branch || '') : 'No'}</td></tr>
        </table>
        <div style="margin-top:24px;">
          <a href="${process.env.BASE_URL}/admin" style="background:#c9a84c;color:#0d0d0d;font-weight:800;font-size:0.78rem;letter-spacing:0.2em;text-transform:uppercase;padding:14px 28px;text-decoration:none;display:inline-block;">
            REVIEW APPLICATION →
          </a>
        </div>
      </div>
      ${footer}
    </div>`;
}

// ─── Public API ───────────────────────────────────────
module.exports = {
  async sendGsocAlert(submission) {
    const subject = `[${(submission.threat_level || 'ROUTINE').toUpperCase()}] New Audit Request — ${submission.reference_number}`;
    return send({
      to: process.env.GSOC_ALERT_EMAIL || 'gsoc@gwplsecurity.com',
      subject,
      html: gsocAlertHtml(submission),
      template: 'gsoc_alert',
      entityType: 'audit',
      entityId: submission.id,
    });
  },

  async sendSubmitterAck(submission) {
    return send({
      to: submission.email,
      subject: `GWPL Security — Request Received [${submission.reference_number}]`,
      html: submitterAckHtml(submission),
      template: 'submitter_ack',
      entityType: 'audit',
      entityId: submission.id,
    });
  },

  async sendCareerConfirm(application) {
    return send({
      to: application.email,
      subject: `GWPL Security — Application Received [${application.reference_number}]`,
      html: careerConfirmHtml(application),
      template: 'career_confirm',
      entityType: 'careers',
      entityId: application.id,
    });
  },

  async sendHrAlert(application) {
    return send({
      to: process.env.HR_ALERT_EMAIL || 'hr@gwplsecurity.com',
      subject: `New Application: ${application.position_applied} — ${application.first_name} ${application.last_name}`,
      html: hrAlertHtml(application),
      template: 'hr_alert',
      entityType: 'careers',
      entityId: application.id,
    });
  },
};