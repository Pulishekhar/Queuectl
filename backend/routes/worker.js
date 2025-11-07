// backend/routes/worker.js
const storage = require('../models/storage');
const config = require('./config');
const { spawn } = require('child_process');

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function runCommand(cmd) {
  return new Promise(resolve => {
    const child = spawn(cmd, { shell: true });
    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', code => resolve({ code, stderr }));
  });
}

async function workerLoop(stopFlag) {
  while (!stopFlag.stop) {
    const job = await storage.claimPendingJob();
    if (!job) {
      await sleep(1000);
      continue;
    }

    console.log(`⚙️  Running job: ${job.id} (${job.command})`);
    const res = await runCommand(job.command);
    const cfg = await config.getConfig();
    const attempts = job.attempts + 1;

    if (res.code === 0) {
      await storage.updateJobState(job.id, { state: 'completed', attempts });
      console.log(`✅ Job ${job.id} completed`);
    } else {
      if (attempts >= job.max_retries) {
        await storage.updateJobState(job.id, { state: 'dead', attempts, last_error: res.stderr });
        console.log(`💀 Job ${job.id} moved to DLQ`);
      } else {
        const delay = Math.pow(cfg.backoff_base, attempts) * 1000;
        await storage.updateJobState(job.id, { state: 'pending', attempts, last_error: res.stderr });
        console.log(`🔁 Retrying ${job.id} in ${delay / 1000}s`);
        await sleep(delay);
      }
    }
  }
  console.log('🛑 Worker stopped.');
}

async function startWorkers(count = 1) {
  const stopFlag = { stop: false };
  for (let i = 0; i < count; i++) workerLoop(stopFlag);

  process.on('SIGINT', () => {
    console.log('🧹 Gracefully stopping workers...');
    stopFlag.stop = true;
  });
}

module.exports = { startWorkers };
