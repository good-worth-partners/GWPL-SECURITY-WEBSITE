/**
 * GWPL Security — Health Check
 * GET /api/health
 */

const express = require('express');
const { db } = require('../db/connection');
const router = express.Router();

router.get('/', (req, res) => {
  let dbOk = false;
  try {
    getDb().prepare('SELECT 1').get();
    dbOk = true;
  } catch(e) {}

  const status = dbOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    service:     'GWPL Security API',
    version:     '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp:   new Date().toISOString(),
    database:    dbOk ? 'connected' : 'error',
    uptime_secs: Math.floor(process.uptime()),
  });
});

module.exports = router;