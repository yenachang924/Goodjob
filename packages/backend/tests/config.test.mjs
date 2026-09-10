import test from 'node:test';
import assert from 'node:assert/strict';
import { validBackendConfig } from '../src/config.ts';
test('backend configuration validates origin, public key and owner UUID', () => {
  const config = {
    url: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_example',
    ownerId: 'ea7eb35c-53c7-4dd4-bce2-7cf443b77d78',
  };
  assert.equal(validBackendConfig(config), true);
  for (const change of [
    { url: 'oops' },
    { url: 'http://remote.test' },
    { ownerId: 'owner' },
    { publishableKey: ' ' },
    { url: 'https://user:password@example.com' },
  ]) {
    assert.equal(validBackendConfig({ ...config, ...change }), false);
  }
  assert.equal(
    validBackendConfig({ ...config, url: 'http://127.0.0.1:54321' }),
    true,
  );
});
