/**
 * Version substitution for the Make app definition.
 *
 * WHY A PLACEHOLDER AND NOT A LITERAL. The rule across every FreightUtils
 * wrapper is that the User-Agent version is DERIVED from package.json and never
 * typed in, so it cannot report a version the package is not. The other three
 * wrappers are JavaScript and read package.json at runtime. Make's app
 * definition is static JSON uploaded to Make's servers — there is no runtime of
 * ours to read anything, and Make's own `{{...}}` templating only reaches
 * connection and parameter values, not our package metadata.
 *
 * So the definition carries `__PKG_VERSION__` and it is substituted at PUSH
 * time from package.json. The literal never exists in a file a human edits, and
 * a stale version can only ship if somebody uploads without going through here
 * — which `assertNoPlaceholders` is what catches.
 *
 * The token is deliberately NOT `{{VERSION}}`: that is Make's own syntax, and a
 * placeholder that looks like the platform's templating is one somebody
 * eventually expects the platform to resolve.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PLACEHOLDER = '__PKG_VERSION__';

/** `name` and `version` from the repo's own package.json. */
export async function pkgMeta() {
  const pkg = JSON.parse(await readFile(path.join(REPO, 'package.json'), 'utf8'));
  if (!pkg.name || !pkg.version) throw new Error('package.json is missing name or version');
  return { name: pkg.name, version: pkg.version };
}

/** Substitute every placeholder in a definition object. Returns a new object. */
export function withVersion(def, version) {
  return JSON.parse(JSON.stringify(def).split(PLACEHOLDER).join(version));
}

/**
 * Refuse to upload anything still carrying the placeholder.
 *
 * Without this the failure is silent and durable: Make would happily accept a
 * literal `make-freightutils/__PKG_VERSION__` User-Agent, every call would
 * carry it, and the server would attribute the traffic to `make` anyway
 * (the prefix still matches) while the version was junk. It would look like it
 * worked.
 */
export function assertNoPlaceholders(def, what) {
  const s = JSON.stringify(def);
  if (s.includes(PLACEHOLDER)) {
    throw new Error(
      `${what} still contains ${PLACEHOLDER} after substitution — refusing to upload. ` +
      'Every definition must go through withVersion() before it reaches Make.',
    );
  }
}
