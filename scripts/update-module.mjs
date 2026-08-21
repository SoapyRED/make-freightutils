#!/usr/bin/env node
/**
 * Update (or create) ONE module on the already-created FreightUtils Make app.
 *
 * WHY THIS EXISTS: push.mjs is a first-run orchestrator — running it against
 * the live app produces a SECOND, auto-suffixed app. update-base.mjs only
 * touches the base section. Nothing wrapped `sdk-modules set-section` for an
 * EXISTING module until the 2026-08-19 parity sprint needed to (a) apply the
 * dry-ice scope-verdict interface+samples to adrExemption and (b) add the
 * resolveReference module — both without recreating the app.
 *
 * Interface and samples move TOGETHER by default: pushing interface alone
 * repeats the v0.2.2 shipmentSummary mapping-panel bug (a field present in
 * interface but absent from samples errors during scenario builds).
 *
 * Env: MAKE_API_KEY (required), MAKE_ZONE (default eu2.make.com),
 *      MAKE_APP_NAME (optional — else resolved by prefix like update-base),
 *      MAKE_APP_VERSION (default 1).
 *
 *   node scripts/update-module.mjs --module=adrExemption               update all 4 sections
 *   node scripts/update-module.mjs --module=adrExemption --sections=interface,samples
 *   node scripts/update-module.mjs --module=resolveReference --create  create + all 4 sections
 *   … any of the above with --dry-run                                  print, send nothing
 *
 * Exit: 0 applied (or dry-run) · 1 could not resolve app/module · 2 no key.
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
const CREATE = process.argv.includes('--create');
const moduleArg = process.argv.find((a) => a.startsWith('--module='))?.slice(9);
const sectionsArg = process.argv.find((a) => a.startsWith('--sections='))?.slice(11);
const SECTIONS = sectionsArg ? sectionsArg.split(',') : ['api', 'expect', 'interface', 'samples'];

if (!moduleArg) {
  console.error('Usage: node scripts/update-module.mjs --module=<name> [--sections=a,b] [--create] [--dry-run]');
  process.exit(1);
}
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
const appRaw = JSON.parse(await readFile(path.join(REPO, 'app', 'app.json'), 'utf8'));
const appMeta = withVersion(appRaw, version);
const modRaw = JSON.parse(await readFile(path.join(REPO, 'app', 'modules', `${moduleArg}.json`), 'utf8'));
const mod = withVersion(modRaw, version);
assertNoPlaceholders(mod, `modules/${moduleArg}.json`);

console.log(`FreightUtils Make app — module ${CREATE ? 'create' : 'update'}: ${mod.name}`);
console.log(`  sections: ${SECTIONS.join(', ')}`);

if (DRY) {
  for (const s of SECTIONS) {
    console.log(`\n--dry-run — section "${s}" that WOULD be uploaded:\n`);
    console.log(JSON.stringify(mod[s], null, 2));
  }
  console.log('\nNothing was sent. Set MAKE_API_KEY and re-run without --dry-run.');
  process.exit(0);
}

// Resolve the live app (same prefix logic + ambiguity stop as update-base).
let appName = process.env.MAKE_APP_NAME;
if (!appName) {
  const list = await cliJson(['sdk-apps', 'list']);
  const apps = Array.isArray(list) ? list : (list.apps ?? []);
  const matches = apps.filter((a) => typeof a.name === 'string' && a.name.startsWith(appMeta.name));
  if (matches.length === 0) {
    console.error(`No SDK app whose name starts with "${appMeta.name}". Has it been created? (scripts/push.mjs)`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Ambiguous: ${matches.length} apps match "${appMeta.name}" — ${matches.map((m) => m.name).join(', ')}. Set MAKE_APP_NAME.`);
    process.exit(1);
  }
  appName = matches[0].name;
}
const appVersion = process.env.MAKE_APP_VERSION || 1;
console.log(`  target  : ${appName} v${appVersion}`);

if (CREATE) {
  await cli([
    'sdk-modules', 'create',
    `--app-name=${appName}`,
    `--app-version=${appVersion}`,
    `--name=${mod.name}`,
    `--type-id=${mod.typeId}`,
    `--label=${mod.label}`,
    `--description=${mod.description}`,
    '--module-init-mode=blank',
  ]);
  console.log(`  ✓ module created (${mod.typeId === 4 ? 'action' : mod.typeId === 9 ? 'search' : `type-${mod.typeId}`})`);

  // Attach the app connection. `sdk-modules create` does NOT set one, and a module
  // without a connection renders no Connection field in the scenario editor — its
  // calls go out with an empty {{connection.apiKey}}, i.e. anonymous and capped
  // (found on resolveReference, 2026-08-21: parameters [] vs __IMTCONN__ on every
  // older module). The repo JSON's `connection` field holds the repo-local name
  // ("apiKey"); the PLATFORM resource has its own generated name, so resolve it
  // from the app's connection list rather than trusting either name.
  if (mod.connection) {
    const zone = process.env.MAKE_ZONE;
    const auth = { Authorization: `Token ${process.env.MAKE_API_KEY}`, 'Content-Type': 'application/json' };
    const connsRes = await fetch(`https://${zone}/api/v2/sdk/apps/${appName}/connections`, { headers: auth });
    const conns = (await connsRes.json()).appConnections || [];
    if (conns.length === 0) {
      console.error(`  ✗ app has no SDK connection to attach — create one in Studio, then re-run with --sections= (empty) to attach`);
      process.exit(1);
    }
    const conn = conns.length === 1 ? conns[0] : conns.find((c) => c.name === mod.connection) || conns[0];
    const patch = await fetch(`https://${zone}/api/v2/sdk/apps/${appName}/${appVersion}/modules/${mod.name}`, {
      method: 'PATCH', headers: auth, body: JSON.stringify({ connection: conn.name }),
    });
    if (!patch.ok) {
      console.error(`  ✗ could not attach connection "${conn.name}" (HTTP ${patch.status}) — attach in Studio before use`);
      process.exit(1);
    }
    console.log(`  ✓ connection attached (${conn.name})`);
  }
}

for (const section of SECTIONS) {
  await cli([
    'sdk-modules', 'set-section',
    `--app-name=${appName}`,
    `--app-version=${appVersion}`,
    `--module-name=${mod.name}`,
    `--section=${section}`,
    `--body=${JSON.stringify(mod[section])}`,
  ]);
  console.log(`  ✓ ${mod.name}.${section}`);
}
console.log('\nDone. Verify in Studio (module → sections) or via app-module_get.');
