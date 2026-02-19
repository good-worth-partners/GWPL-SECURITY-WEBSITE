/**
 * GWPL Security — Main Server
 */

require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const path        = require('path');
const rateLimit   = require('express-rate-limit');

const app = express();

// ─── Security & Middleware ───────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com"],
      fontSrc:    ["'self'", "fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:"],
    }
  }
}));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Static files ────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rate Limiting ───────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Too many requests. Please try again later.' }
});

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      10,
  message: { success: false, error: 'Too many submission attempts. Please call our hotline directly.' }
});

app.use('/api/', generalLimiter);
app.use('/api/audit/submit',   strictLimiter);
app.use('/api/careers/apply',  strictLimiter);

// ─── Routes ──────────────────────────────────────────
app.use('/api/audit',   require('./routes/audit'));
app.use('/api/careers', require('./routes/careers'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/health',  require('./routes/health'));

// ─── Serve frontend for all non-API routes ───────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Global error handler ────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  if (process.env.NODE_ENV === 'development') console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred.'
      : err.message
  });
});

// ─── Start ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🛡  GWPL Security Backend`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Server      : http://localhost:${PORT}`);
  console.log(`   API Base    : http://localhost:${PORT}/api\n`);
});

module.exports = app;