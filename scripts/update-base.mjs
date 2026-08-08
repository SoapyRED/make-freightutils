#!/usr/bin/env node
/**
 * Update the BASE SECTION of the already-created FreightUtils Make app.
 *
 * WHY THIS EXISTS SEPARATELY FROM push.mjs: push.mjs is a first-run
 * orchestrator — it CREATES the app, the connection and all 20 modules, and
 * Make auto-suffixes the name if one already exists. Running it against the
 * live app would produce a SECOND app rather than updating the first. This
 * script only sets the base section on an app that is already there, which is
 * all the User-Agent change needs: `base.headers` is inherited by every module,
 * so one section update covers the whole app with no module churn.
 *
 * Env: MAKE_API_KEY (required), MAKE_ZONE (defaults to eu2.make.com),
 *      MAKE_APP_NAME (optional — otherwise resolved by listing SDK apps and
 *      matching the name in app/app.json), MAKE_APP_VERSION (defaults to 1).
 *
 *   node scripts/update-base.mjs            apply
 *   node scripts/update-base.mjs --dry-run  print what would be uploaded
 *
 * Exit: 0 applied (or dry-run clean) · 1 could not resolve the app · 2 no key.
 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pkgMeta, withVersion, assertNoPlaceholders } from './version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const CLI = path.join(REPO, 'node_modules', '@makehq', 'cli', 'dist', 'index.js');
const DRY = process.argv.includes('--dry-run');

if (!process.env.MAKE_API_KEY && !DRY) {
  console.error('MAKE_API_KEY not set — cannot reach Make. (Use --dry-run to see the payload.)');
  process.exit(2);
}
if (!process.env.MAKE_ZONE) process.env.MAKE_ZONE = 'eu2.make.com';

function cli(args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [CLI, ...args], { env: process.env, maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) { err.stdout = stdout; err.stderr = stderr; return reject(err); }
        resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
      });
  });
}
async function cliJson(args) {
  const { stdout } = await cli(['--output', 'json', ...args]);
  try { return JSON.parse(stdout); } catch { return stdout; }
}

const { version } = await pkgMeta();
const raw = JSON.parse(await readFile(path.join(REPO, 'app', 'app.json'), 'utf8'));
const app = withVersion(raw, version);
assertNoPlaceholders(app, 'app.json');

console.log('FreightUtils Make app — base section update');
console.log(`  package version : ${version}`);
console.log(`  User-Agent      : ${app.base?.headers?.['User-Agent'] ?? '(none)'}`);

if (DRY) {
  console.log('\n--dry-run — the base section that WOULD be uploaded:\n');
  console.log(JSON.stringify(app.base, null, 2));
  console.log('\nNothing was sent. Set MAKE_API_KEY and re-run without --dry-run.');
  process.exit(0);
}

// Resolve the live app. Named explicitly via MAKE_APP_NAME, else matched by
// prefix — Make auto-suffixes on name collision, so the live name may not be
// exactly what app.json requested.
let appName = process.env.MAKE_APP_NAME;
if (!appName) {
  const list = await cliJson(['sdk-apps', 'list']);
  const apps = Array.isArray(list) ? list : (list.apps ?? []);
  const matches = apps.filter((a) => typeof a.name === 'string' && a.name.startsWith(app.name));
  if (matches.length === 0) {
    console.error(`No SDK app whose name starts with "${app.name}". Has it been created? (scripts/push.mjs)`);
    process.exit(1);
  }
  if (matches.length > 1) {
    // Guessing between two apps could update the wrong one and leave the live
    // app silently unchanged — worse than stopping.
    console.error(`Ambiguous: ${matches.length} apps match "${app.name}" — ${matches.map((m) => m.name).join(', ')}.`);
    console.error('Set MAKE_APP_NAME to the one you mean.');
    process.exit(1);
  }
  appName = matches[0].name;
}
const appVersion = process.env.MAKE_APP_VERSION || 1;
console.log(`  target          : ${appName} v${appVersion}`);

await cli([
  'sdk-apps', 'set-section',
  `--name=${appName}`,
  `--version=${appVersion}`,
  '--section=base',
  `--body=${JSON.stringify(app.base)}`,
]);
console.log('  ✓ base section updated — every module inherits these headers.');
console.log('\nNext: run one real scenario against the app, then check the per-surface');
console.log('counter on /api/admin/metrics — the `make` row proves it end to end.');
