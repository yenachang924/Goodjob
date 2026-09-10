import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
test('one application and two internal workspaces', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(pkg.workspaces, ['apps/*', 'packages/*']);
  assert.ok(existsSync(new URL('apps/web/package.json', root)));
  assert.ok(existsSync(new URL('packages/backend/package.json', root)));
  assert.ok(existsSync(new URL('packages/shared/package.json', root)));
});
function sources(dir) {
  if (dir instanceof URL) dir = fileURLToPath(dir);
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : /\.[cm]?[jt]sx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );
}
test('pure and browser packages do not depend on server implementation', () => {
  assert.ok(existsSync(new URL('packages/shared/src', root)));
  for (const file of sources(new URL('packages/shared/src', root))) {
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /@cockpit\/backend|cloudflare:|from ['"]next|process\.env/,
    );
  }
  for (const file of sources(new URL('apps/web/features', root))) {
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /@cockpit\/backend|SUPABASE_SERVICE_ROLE/,
    );
  }
});
