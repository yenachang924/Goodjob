import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';

const diagnostics = await import('../src/diagnostics.ts').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const configIssue = (config) => {
  assert.equal(
    typeof diagnostics.configIssue,
    'function',
    'configIssue must exist',
  );
  return diagnostics.configIssue(config);
};
const reportUnavailable = (...args) => {
  assert.equal(
    typeof diagnostics.reportUnavailable,
    'function',
    'reportUnavailable must exist',
  );
  return diagnostics.reportUnavailable(...args);
};
const valid = {
  url: 'https://example.supabase.co',
  publishableKey: 'synthetic-public-key',
  ownerId: '12345678-1234-1234-1234-123456789abc',
};

test('valid configuration has no diagnostic issue', () => {
  assert.equal(configIssue(valid), null);
});

for (const field of ['url', 'publishableKey', 'ownerId']) {
  test(`missing ${field} is identified without exposing values`, () => {
    for (const value of [undefined, '']) {
      assert.deepEqual(configIssue({ ...valid, [field]: value }), {
        stage: 'config',
        field,
        reason: 'missing',
      });
    }
  });
}

for (const [field, value] of [
  ['url', 'not-a-url'],
  ['url', 'http://example.com'],
  ['url', 'https://user:password@example.com'],
  ['publishableKey', '   '],
  ['ownerId', 'not-a-uuid'],
  ['ownerId', ` ${valid.ownerId}`],
]) {
  test(`invalid ${field} yields only a safe field identifier (${value === '   ' ? 'blank' : value.split(':')[0]})`, () => {
    assert.deepEqual(configIssue({ ...valid, [field]: value }), {
      stage: 'config',
      field,
      reason: 'invalid',
    });
  });
}

test('loopback HTTP and uppercase UUID preserve existing validation behavior', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(
      configIssue({
        ...valid,
        url: `http://${host}:3000`,
        ownerId: valid.ownerId.toUpperCase(),
      }),
      null,
    );
  }
});

test('configuration failures log allowlisted metadata and return the existing generic 503', async () => {
  const calls = [];
  const response = reportUnavailable(
    {
      stage: 'config',
      field: 'ownerId',
      reason: 'invalid',
      secret: 'DO-NOT-LOG',
      message: 'DO-NOT-LOG',
    },
    (...args) => calls.push(args),
  );
  assert.deepEqual(calls, [
    [
      '[workspace-unavailable]',
      {
        stage: 'config',
        field: 'ownerId',
        reason: 'invalid',
      },
    ],
  ]);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    error: 'Supabase와 소유자 설정이 필요합니다.',
  });
});

test('initialization failures omit exception messages, stacks, and unexpected fields', async () => {
  const calls = [];
  const response = reportUnavailable(
    {
      stage: 'initialize',
      error: new Error('DO-NOT-LOG'),
      message: 'DO-NOT-LOG',
      stack: 'DO-NOT-LOG',
      field: 'DO-NOT-LOG',
    },
    (...args) => calls.push(args),
  );
  assert.deepEqual(calls, [
    ['[workspace-unavailable]', { stage: 'initialize' }],
  ]);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'Supabase와 소유자 설정이 필요합니다.',
  });
});

function endpointResult(ownerId) {
  const source = `
    import { workspaceEndpoint } from './packages/backend/src/index.ts';
    const logs = [];
    console.error = (...args) => logs.push(args);
    globalThis.fetch = () => { throw new Error('Network must not be used'); };
    const response = await workspaceEndpoint(new Request('https://example.com/api/workspace'));
    process.stdout.write(JSON.stringify({ status: response.status, logs }));
  `;
  const result = spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      source,
    ],
    {
      cwd: new URL('../../../', import.meta.url),
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: valid.url,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valid.publishableKey,
        COCKPIT_OWNER_ID: ownerId,
        COCKPIT_WEB_ORIGIN: 'https://example.com',
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('endpoint identifies missing configuration in logs', () => {
  assert.deepEqual(endpointResult(''), {
    status: 503,
    logs: [
      [
        '[workspace-unavailable]',
        { stage: 'config', field: 'ownerId', reason: 'missing' },
      ],
    ],
  });
});

test('configured unauthenticated endpoint returns 401 with no diagnostics or network', () => {
  assert.deepEqual(endpointResult(valid.ownerId), { status: 401, logs: [] });
});
