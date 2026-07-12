/**
 * QA summarizer — parses Playwright's JSON results into category verdicts,
 * writes test-results/qa-reports/latest.md + history.json and refreshes
 * public/qa-status.json (which the Command Center's AI QA Lab panel reads).
 *
 * Usable standalone (after `npm run test:e2e`):  node scripts/summarize-qa.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RESULTS = path.join(ROOT, 'test-results', 'results.json');
const REPORT_DIR = path.join(ROOT, 'test-results', 'qa-reports');
const SCREENSHOT_DIR = path.join(ROOT, 'test-results', 'screenshots');
const STATUS_JSON = path.join(ROOT, 'public', 'qa-status.json');

const CATEGORY_BY_FILE = {
  'smoke.spec.ts': 'smoke',
  'command-center.spec.ts': 'commandCenter',
  'save-system.spec.ts': 'saveReload',
  'visual-snapshots.spec.ts': 'visualSnapshots',
};

/** playtest.spec.ts splits into two categories by describe title */
function categoryFor(file, path_) {
  const base = path.basename(file);
  if (base === 'playtest.spec.ts') {
    return /movement/i.test(path_.join(' ')) ? 'movement' : 'questFlow';
  }
  return CATEGORY_BY_FILE[base] ?? base.replace('.spec.ts', '');
}

export function collectSpecs(suite, file = suite.file ?? '', trail = [], out = []) {
  const nextTrail = suite.title ? [...trail, suite.title] : trail;
  for (const spec of suite.specs ?? []) {
    const ok = spec.ok === true;
    out.push({ file: suite.file ?? file, trail: nextTrail, title: spec.title, ok });
  }
  for (const child of suite.suites ?? []) collectSpecs(child, suite.file ?? file, nextTrail, out);
  return out;
}

export function summarize({ typecheckPass, buildPass, note = '' } = {}) {
  mkdirSync(REPORT_DIR, { recursive: true });

  let specs = [];
  let parseNote = '';
  if (existsSync(RESULTS)) {
    try {
      const data = JSON.parse(readFileSync(RESULTS, 'utf8'));
      for (const suite of data.suites ?? []) collectSpecs(suite, suite.file ?? '', [], specs);
    } catch (err) {
      parseNote = `Could not parse Playwright results: ${err}`;
    }
  } else {
    parseNote = 'No Playwright results.json found — e2e run missing or crashed.';
  }

  const categories = {
    typecheck: typecheckPass === undefined ? 'NOT RUN' : typecheckPass ? 'PASS' : 'FAIL',
    build: buildPass === undefined ? 'NOT RUN' : buildPass ? 'PASS' : 'FAIL',
    smoke: 'NOT RUN',
    movement: 'NOT RUN',
    questFlow: 'NOT RUN',
    commandCenter: 'NOT RUN',
    saveReload: 'NOT RUN',
    visualSnapshots: 'NOT RUN',
  };

  const failures = [];
  for (const spec of specs) {
    const cat = categoryFor(spec.file, spec.trail);
    if (!(cat in categories)) categories[cat] = 'NOT RUN';
    if (spec.ok) {
      if (categories[cat] !== 'FAIL') categories[cat] = 'PASS';
    } else {
      categories[cat] = 'FAIL';
      failures.push(`${cat}: ${spec.trail.join(' › ')}${spec.trail.length ? ' › ' : ''}${spec.title}`);
    }
  }

  const ranCategories = Object.entries(categories).filter(([, v]) => v !== 'NOT RUN');
  const allPass = ranCategories.length > 0 && ranCategories.every(([, v]) => v === 'PASS') && specs.length > 0;
  const result = allPass ? 'PASS' : 'FAIL';

  // history
  const historyPath = path.join(REPORT_DIR, 'history.json');
  let history = [];
  if (existsSync(historyPath)) {
    try {
      history = JSON.parse(readFileSync(historyPath, 'utf8'));
    } catch {
      history = [];
    }
  }
  const iteration = history.length + 1;
  const lastRun = new Date().toISOString();

  let screenshots = [];
  if (existsSync(SCREENSHOT_DIR)) {
    screenshots = readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith('.png'));
  }

  const status = allPass
    ? 'READY FOR HUMAN PLAYTESTING'
    : specs.length === 0
      ? 'AUTOMATED TESTING IN PROGRESS'
      : 'NEEDS FIXES';

  const entry = { iteration, lastRun, result, categories, failures, screenshots };
  history.push(entry);
  writeFileSync(historyPath, JSON.stringify(history, null, 2));

  const combinedNote = [note, parseNote].filter(Boolean).join(' — ');

  // Command Center payload
  const statusPayload = {
    status,
    lastRun,
    iteration,
    result,
    categories,
    bugsFound: failures,
    bugsFixed: [],
    remaining: failures,
    screenshots,
    note: combinedNote || (allPass ? 'All automated checks green. Next: human playtest (see PLAYTEST.md).' : ''),
  };
  writeFileSync(STATUS_JSON, JSON.stringify(statusPayload, null, 2));

  // markdown report
  const md = `# BLIP AI QA Report

Date: ${lastRun}
Build: v0.1.0-slice
Iteration: ${iteration}

## Result
${result}

## Automated Checks
${Object.entries(categories)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

## Bugs Found
${failures.length ? failures.map((f) => `- ${f}`).join('\n') : '- none in this run'}

## Bugs Fixed This Iteration
- (see git/session log — the AI fixes root causes between iterations)

## Remaining Issues
${failures.length ? failures.map((f) => `- ${f}`).join('\n') : '- none known from automation'}

## Screenshots
${screenshots.length ? screenshots.map((s) => `- test-results/screenshots/${s}`).join('\n') : '- none captured'}

## Human Playtesting Needed
- Feel/tuning of run, jump, hover, dash timing
- Is the scan mechanic discoverable without hints?
- Is Will's badge trail satisfying to find?
- Blipstream puzzle difficulty and readability
- Scarecrow Antenna difficulty curve
- Story tone (mysterious but warm), Command Center usefulness
${combinedNote ? `\n## Notes\n${combinedNote}\n` : ''}`;

  writeFileSync(path.join(REPORT_DIR, 'latest.md'), md);
  return { result, status, categories, failures, iteration, screenshots };
}

// standalone execution
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const summary = summarize({});
  console.log(`[summarize-qa] ${summary.result} — ${summary.status}`);
  for (const [k, v] of Object.entries(summary.categories)) console.log(`  ${k}: ${v}`);
  process.exit(summary.result === 'PASS' ? 0 : 1);
}
