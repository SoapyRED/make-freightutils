#!/usr/bin/env node

/**
 * Push the FreightUtils Make app + connection + 17 modules.
 *
 * Reads the JSON definitions under ../app/ and uploads them via the
 * locally-installed @makehq/cli. CLI is invoked via Node's execFile
 * against the CLI's JS entry (node node_modules/@makehq/cli/dist/index.js)
 * — avoids Windows shell quoting issues for JSON --body payloads.
 *
 * Env: MAKE_API_KEY (required), MAKE_ZONE (defaults to eu2.make.com).
 *
 * This is a first-run orchestrator. If an app with the requested name
 * already exists on the account, Make auto-suffixes — the returned
 * name is what's used for all follow-on calls.
 */

import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const CLI = path.join(REPO, 'node_modules', '@makehq', 'cli', 'dist', 'index.js');

if (!process.env.MAKE_API_KEY) {
	console.error('MAKE_API_KEY not set');
	process.exit(1);
}
if (!process.env.MAKE_ZONE) process.env.MAKE_ZONE = 'eu2.make.com';

function cli(args) {
	return new Promise((resolve, reject) => {
		execFile(
			process.execPath,
			[CLI, ...args],
			{ env: process.env, maxBuffer: 20 * 1024 * 1024 },
			(err, stdout, stderr) => {
				if (err) {
					err.stdout = stdout; err.stderr = stderr;
					return reject(err);
				}
				resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
			},
		);
	});
}

async function cliJson(args) {
	const { stdout } = await cli(['--output', 'json', ...args]);
	try { return JSON.parse(stdout); } catch {
		return stdout;
	}
}

async function loadJson(p) { return JSON.parse(await readFile(p, 'utf8')); }

async function main() {
	console.log('→ Loading definitions');
	const app = await loadJson(path.join(REPO, 'app', 'app.json'));
	const conn = await loadJson(path.join(REPO, 'app', 'connection.json'));
	const moduleFiles = (await readdir(path.join(REPO, 'app', 'modules'))).filter(f => f.endsWith('.json')).sort();
	const modules = await Promise.all(moduleFiles.map(f => loadJson(path.join(REPO, 'app', 'modules', f))));
	const actionCount = modules.filter(m => m.typeId === 4).length;
	const searchCount = modules.filter(m => m.typeId === 9).length;
	console.log(`  requested name: ${app.name}`);
	console.log(`  modules: ${modules.length} total (${actionCount} actions + ${searchCount} searches)`);

	console.log('\n→ Creating app');
	const createArgs = [
		'sdk-apps', 'create',
		`--name=${app.name}`,
		`--label=${app.label}`,
		`--description=${app.description}`,
		`--theme=${app.theme}`,
		`--language=${app.language}`,
		`--audience=${app.audience || 'global'}`,
	];
	if (app.private) createArgs.push('--private');
	if (app.countries?.length) createArgs.push(`--countries=${JSON.stringify(app.countries)}`);

	const created = await cliJson(createArgs);
	const appName = created.name;
	const appVersion = created.version || 1;
	console.log(`  ✓ created: ${appName} v${appVersion}`);

	console.log('\n→ Setting app base section');
	await cli([
		'sdk-apps', 'set-section',
		`--name=${appName}`,
		`--version=${appVersion}`,
		'--section=base',
		`--body=${JSON.stringify(app.base)}`,
	]);
	console.log('  ✓ base');

	console.log('\n→ Creating connection');
	const connCreated = await cliJson([
		'sdk-connections', 'create',
		`--app-name=${appName}`,
		`--type=${conn.type}`,
		`--label=${conn.label}`,
	]);
	const connName = connCreated.name || `${appName}-1`;
	console.log(`  ✓ connection: ${connName} (type=${conn.type})`);

	console.log('\n→ Setting connection sections');
	for (const section of ['parameters', 'api']) {
		await cli([
			'sdk-connections', 'set-section',
			`--connection-name=${connName}`,
			`--section=${section}`,
			`--body=${JSON.stringify(conn[section])}`,
		]);
		console.log(`  ✓ connection.${section}`);
	}

	console.log('\n→ Creating modules');
	for (const m of modules) {
		await cli([
			'sdk-modules', 'create',
			`--app-name=${appName}`,
			`--app-version=${appVersion}`,
			`--name=${m.name}`,
			`--type-id=${m.typeId}`,
			`--label=${m.label}`,
			`--description=${m.description}`,
			'--module-init-mode=blank',
		]);
		for (const section of ['api', 'expect', 'interface', 'samples']) {
			await cli([
				'sdk-modules', 'set-section',
				`--app-name=${appName}`,
				`--app-version=${appVersion}`,
				`--module-name=${m.name}`,
				`--section=${section}`,
				`--body=${JSON.stringify(m[section])}`,
			]);
		}
		const kind = m.typeId === 4 ? 'action' : m.typeId === 9 ? 'search' : `type-${m.typeId}`;
		console.log(`  ✓ ${m.name.padEnd(20)} ${kind}`);
	}

	console.log(`\n→ Done`);
	console.log(`  App name: ${appName}`);
	console.log(`  Version:  ${appVersion}`);
	console.log(`  Zone:     ${process.env.MAKE_ZONE}`);
	console.log(`  Studio:   https://${process.env.MAKE_ZONE}/sdk/apps/${appName}/${appVersion}`);
	console.log(`  (Invite URL is on the Studio page under "Invite users" — Make does not expose it via the SDK API.)`);
}

main().catch(err => {
	console.error('\n✗ Push failed:', err.message);
	if (err.stdout) console.error('stdout:', err.stdout.toString().slice(-800));
	if (err.stderr) console.error('stderr:', err.stderr.toString().slice(-800));
	process.exit(1);
});
