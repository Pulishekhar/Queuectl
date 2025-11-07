// backend/models/storage.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

let db;

// ensure db folder exists
const dbDir = path.join(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const dbPath = path.join(dbDir, 'queue.db');

async function init() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      state TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      created_at TEXT,
      updated_at TEXT,
      last_error TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  console.log("✅ Database initialized at", dbPath);
}

async function addJob(job) {
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [job.id, job.command, job.state || 'pending', job.attempts || 0, job.max_retries || 3, now, now]
  );
}

async function listJobsByState(state) {
  if (state) return await db.all(`SELECT * FROM jobs WHERE state = ?`, [state]);
  return await db.all(`SELECT * FROM jobs`);
}

async function getJob(id) {
  return await db.get(`SELECT * FROM jobs WHERE id = ?`, [id]);
}

async function updateJobState(id, fields) {
  const now = new Date().toISOString();
  const keys = Object.keys(fields);
  const setPart = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);
  values.push(now, id);
  await db.run(
    `UPDATE jobs SET ${setPart}, updated_at = ? WHERE id = ?`,
    values
  );
}

async function claimPendingJob() {
  const job = await db.get(
    `SELECT * FROM jobs WHERE state = 'pending' ORDER BY created_at ASC LIMIT 1`
  );
  if (!job) return null;
  const result = await db.run(
    `UPDATE jobs SET state = 'processing', updated_at = ? WHERE id = ? AND state = 'pending'`,
    [new Date().toISOString(), job.id]
  );
  return result.changes === 1 ? job : null;
}

async function setMeta(key, obj) {
  const json = JSON.stringify(obj);
  await db.run(
    `INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`,
    [key, json]
  );
}

async function getMeta(key) {
  const row = await db.get(`SELECT value FROM meta WHERE key = ?`, [key]);
  return row ? JSON.parse(row.value) : null;
}

module.exports = {
  init,
  addJob,
  listJobsByState,
  getJob,
  updateJobState,
  claimPendingJob,
  setMeta,
  getMeta,
};
