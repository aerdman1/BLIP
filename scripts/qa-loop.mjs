/**
 * BLIP AI QA loop — one bounded pass:
 *   typecheck → build → Playwright e2e → summarize → report.
 *
 * The loop is: run this, read test-results/qa-reports/latest.md, fix root
 * causes, run again. It refuses to spin more than MAX_ITERATIONS times
 * without a green run (see .claude/skills/playtest-qa).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { summarize } from './summarize-qa.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MAX_ITERATIONS = 5;

function run(label, cmd, args) {
  console.log(`\n[qa-loop] ▸ ${label}: ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  const pass = res.status === 0;
  console.log(`[qa-loop] ${label}: ${pass ? 'PASS' : `FAIL (exit ${res.status})`}`);
  return pass;
}

// bounded-loop guard
const historyPath = path.join(ROOT, 'test-results', 'qa-reports', 'history.json');
if (existsSync(historyPath)) {
  try {
    const history = JSON.parse(readFileSync(historyPath, 'utf8'));
    const recent = history.slice(-MAX_ITERATIONS);
    if (recent.length >= MAX_ITERATIONS && recent.every((h) => h.result === 'FAIL')) {
      console.error(
        `[qa-loop] ${MAX_ITERATIONS} consecutive failing iterations — stopping. ` +
          'Read test-results/qa-reports/latest.md, fix root causes, then rerun.'
      );
      process.exit(2);
    }
  } catch {
    /* unreadable history — proceed */
  }
}

const typecheckPass = run('typecheck', 'npm', ['run', 'typecheck']);
const buildPass = typecheckPass && run('build', 'npm', ['run', 'build']);
// run e2e even if build failed? No — preview needs dist. Skip to report.
let e2eRan = false;
if (buildPass) {
  run('e2e', 'npx', ['playwright', 'test']);
  e2eRan = true;
}

const summary = summarize({
  typecheckPass,
  buildPass,
  note: e2eRan ? '' : 'e2e skipped because typecheck/build failed.',
});

console.log('\n[qa-loop] ══════════════════════════════════════');
console.log(`[qa-loop] RESULT: ${summary.result}  →  STATUS: ${summary.status}`);
for (const [k, v] of Object.entries(summary.categories)) console.log(`[qa-loop]   ${k}: ${v}`);
if (summary.failures.length) {
  console.log('[qa-loop] failures:');
  for (const f of summary.failures) console.log(`[qa-loop]   ✗ ${f}`);
}
console.log(`[qa-loop] report: test-results/qa-reports/latest.md (iteration ${summary.iteration})`);
console.log('[qa-loop] command center panel data refreshed: public/qa-status.json');
process.exit(summary.result === 'PASS' ? 0 : 1);
