// backend/routes/jobManager.js
const storage = require('../models/storage');
const { v4: uuidv4 } = require('uuid');

// Add a new job to queue
async function enqueue(jobJson) {
  const data = typeof jobJson === 'string' ? JSON.parse(jobJson) : jobJson;

  if (!data.command) {
    console.log("❌ Missing 'command' field in job JSON");
    return;
  }

  const job = {
    id: data.id || uuidv4(),
    command: data.command,
    state: 'pending',
    attempts: 0,
    max_retries: data.max_retries || 3,
  };

  await storage.addJob(job);
  console.log(`✅ Enqueued job: ${job.id}`);
}

// List jobs (all or by state)
async function list(state) {
  const jobs = await storage.listJobsByState(state);
  if (!jobs.length) {
    console.log("ℹ️  No jobs found.");
    return;
  }

  console.table(jobs.map(j => ({
    id: j.id,
    command: j.command,
    state: j.state,
    attempts: j.attempts,
    max_retries: j.max_retries
  })));
}

// Dead Letter Queue operations
async function dlqList() {
  const jobs = await storage.listJobsByState('dead');
  if (!jobs.length) return console.log("🪦 No dead jobs found.");
  console.table(jobs);
}

async function dlqRetry(id) {
  const job = await storage.getJob(id);
  if (!job) return console.log("❌ Job not found.");
  if (job.state !== 'dead') return console.log("⚠️  Job is not in DLQ.");

  await storage.updateJobState(id, { state: 'pending', attempts: 0, last_error: null });
  console.log(`♻️  Retried DLQ job: ${id}`);
}

// ✅ NEW: Status summary (Phase 6)
async function status() {
  const states = ['pending', 'processing', 'completed', 'dead'];
  const counts = {};

  for (const s of states) {
    const jobs = await storage.listJobsByState(s);
    counts[s] = jobs.length;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  console.log(`
📊  Job Summary
─────────────────────────────
Pending     : ${counts.pending}
Processing  : ${counts.processing}
Completed   : ${counts.completed}
Dead        : ${counts.dead}
─────────────────────────────
Total Jobs  : ${total}
  `);
}

module.exports = { enqueue, list, dlqList, dlqRetry, status };
