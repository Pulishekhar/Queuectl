#!/usr/bin/env node
const { Command } = require('commander');
const storage = require('../models/storage');
const jobManager = require('../routes/jobManager');
const worker = require('../routes/worker');
const config = require('../routes/config');

(async () => {
  await storage.init();

  const program = new Command();
  program.name('queuectl').description('QueueCTL - background job queue CLI');

  // Enqueue
  program
    .command('enqueue [job]')
    .description('Add a new job (JSON string or piped input)')
    .action(async (job) => {
      if (!job) {
        const chunks = [];
        for await (const chunk of process.stdin) chunks.push(chunk);
        job = Buffer.concat(chunks).toString().trim();
      }
      await jobManager.enqueue(job);
    });

  // List
  program
    .command('list')
    .option('--state <state>', 'Filter by job state')
    .action(async (opts) => await jobManager.list(opts.state));

  // Worker
  program
    .command('worker:start')
    .option('--count <n>', 'Number of workers', 1)
    .action(async (opts) => await worker.startWorkers(parseInt(opts.count)));

  // DLQ
  program
    .command('dlq:list')
    .description('View Dead Letter Queue')
    .action(async () => await jobManager.dlqList());

  program
    .command('dlq:retry <id>')
    .description('Retry a DLQ job by ID')
    .action(async (id) => await jobManager.dlqRetry(id));

  // Config
  program
    .command('config:set <key> <value>')
    .description('Change configuration (max_retries, backoff_base)')
    .action(async (key, value) => {
      const cfg = await config.setConfig(key, Number(value));
      console.log('⚙️ Updated config:', cfg);
    });

  // ✅ NEW: Status Summary
  program
    .command('status')
    .description('Show job counts by state')
    .action(async () => await jobManager.status());

  await program.parseAsync(process.argv);
})();
