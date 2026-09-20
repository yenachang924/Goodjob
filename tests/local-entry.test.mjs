import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('root and cloud entrypoints keep local access separate from authentication', async () => {
  const root = await readFile(
    new URL('../apps/web/app/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(root, /LocalEntry/);
  assert.doesNotMatch(root, /AuthGate/);
  const cloud = await readFile(
    new URL('../apps/web/app/cloud/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(cloud, /AuthGate/);
});

test('local entry routes only auth callbacks to a fixed same-origin cloud page', async () => {
  const module =
    await import('../apps/web/features/project-control/entry-routing.ts').catch(
      () => ({}),
    );
  assert.equal(typeof module.cloudCallbackPath, 'function');
  const route = module.cloudCallbackPath;
  for (const hash of ['', '#today', '#project=123'])
    assert.equal(route(hash), null);
  for (const hash of [
    '#type=recovery',
    '#access_token=synthetic&refresh_token=synthetic',
    '#error=access_denied',
    '#error_code=otp_expired',
  ])
    assert.equal(route(hash, '?from=email'), `/cloud?from=email${hash}`);
  assert.equal(
    route('#type=recovery', '?next=https://evil.test'),
    '/cloud?next=https://evil.test#type=recovery',
  );
});
