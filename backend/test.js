// backend/test.js
// Automated test script for QueueCTL (robust against spaces in paths)

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cliPath = path.join(__dirname, 'cli', 'cli.js'); // absolute path to cli
const nodeExec = process.execPath; // path to node binary

function runCmd(args) {
  // args: array of strings, e.g. ['enqueue', '{"command":"echo hi"}']
  console.log(`\n🧩 Running: node ${cliPath} ${args.join(' ')}`);
  try {
    const out = execFileSync(nodeExec, [cliPath, ...args], { encoding: 'utf8' });
    console.log(out.trim());
    return { ok: true, out };
  } catch (err) {
    // err.stdout can contain the CLI output (even on error)
    const stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    console.error('❌ Command failed:', stderr.trim());
    if (stdout) console.log('--- stdout ---\n' + stdout.trim());
    return { ok: false, err, stdout, stderr };
  }
}

(async () => {
  console.log("🚀 QueueCTL Automated Test Started");

  // 1) Reset DB (delete file) so test is deterministic
  const dbPath = path.join(__dirname, 'db', 'queue.db');
  if (fs.existsSync(dbPath)) {
    try { fs.unlinkSync(dbPath); console.log('🧹 DB reset (deleted existing queue.db)'); }
    catch(e) { console.warn('⚠️ Could not delete DB:', e.message); }
  }

  // 2) Enqueue two jobs
  runCmd(['enqueue', JSON.stringify({ command: 'echo Job 1' })]);
  runCmd(['enqueue', JSON.stringify({ command: 'echo Job 2' })]);

  // 3) List jobs
  runCmd(['list']);

  // 4) Start a worker (this call will return quickly because worker.startWorkers launches loops)
  //    We start it as a separate process to let it run — but execFileSync waits, so run worker for a short timeout:
  //    Instead, run worker:start in a synchronous call which will run until SIGINT; to keep this test simple
  //    we'll start a short-lived worker by launching node with a small timeout wrapper.
  //    For simplicity here, start worker and allow it to process for 3 seconds using a helper script approach.
  //
  // Quick approach: run worker:start in a child process with a timeout using spawnSync-like behavior.
  // But execFileSync blocks until completion; to keep script simple and cross-platform, use 'worker:start --count 1'
  // and rely on the implementation to finish when queue finishes (our worker exits when no more jobs and stopFlag not set).
  //
  runCmd(['worker:start', '--count', '1']);

  // 5) Status
  runCmd(['status']);

  console.log("\n✅ Automated Test Completed (see outputs above).");
})();
