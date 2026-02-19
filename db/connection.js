const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './db/gwpl.db';
const dir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new sqlite3.Database(path.resolve(DB_PATH), (err) => {
  if (err) console.error('DB connection error:', err.message);
});

db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

module.exports = { db };