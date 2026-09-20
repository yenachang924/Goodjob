import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalRequest,
  emptyLocalData,
  LOCAL_WORKSPACE_KEY,
  localWorkspaceRequest,
} from '../apps/web/features/project-control/local-storage.ts';
import { MAX_WORKSPACE_BYTES } from '../packages/shared/src/backup.ts';

function memory(initial = null) {
  let raw = initial;
  return {
    getItem: () => raw,
    setItem: (_key, value) => {
      raw = value;
    },
  };
}
function serialLocks() {
  let tail = Promise.resolve();
  return {
    request: (_name, action) => {
      const result = tail.then(action);
      tail = result.catch(() => {});
      return result;
    },
  };
}
const put = (data = emptyLocalData(), revision = 0) => ({
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data, revision }),
});
const projectData = (name = '내 프로젝트') => ({
  ...emptyLocalData(),
  projects: [{ id: 'p1', name, description: '', link: '', archived: false }],
});

test('empty local GET is V2 revision zero and never initializes storage', async () => {
  const storage = memory();
  const response = await createLocalRequest(storage, undefined)();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: emptyLocalData(),
    revision: 0,
  });
  assert.equal(storage.getItem(LOCAL_WORKSPACE_KEY), null);
  assert.notEqual(emptyLocalData().projects, emptyLocalData().projects);
});

test('PUT persists validated data across adapters but not independent stores', async () => {
  const storage = memory();
  assert.equal(
    (await createLocalRequest(storage, serialLocks())(put(projectData())))
      .status,
    200,
  );
  const body = await (
    await createLocalRequest(storage, serialLocks())()
  ).json();
  assert.deepEqual(body, { data: projectData(), revision: 1 });
  assert.equal(
    (await (await createLocalRequest(memory(), undefined)()).json()).revision,
    0,
  );
});

test('concurrent stale writes serialize and preserve the first commit', async () => {
  const storage = memory();
  const locks = serialLocks();
  const results = await Promise.all([
    createLocalRequest(storage, locks)(put(projectData('first'))),
    createLocalRequest(storage, locks)(put(projectData('second'))),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 409],
  );
  assert.equal(JSON.parse(storage.getItem()).data.projects[0].name, 'first');
  assert.equal(
    (await createLocalRequest(storage, locks)(put(projectData('updated'), 1)))
      .status,
    200,
  );
  assert.equal(JSON.parse(storage.getItem()).revision, 2);
});

test('writes without Web Locks fail closed', async () => {
  const storage = memory();
  const response = await createLocalRequest(storage, undefined)(put());
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /브라우저/);
  assert.equal(storage.getItem(), null);
});

for (const raw of [
  '{broken',
  'null',
  '{}',
  JSON.stringify({ data: emptyLocalData(), revision: 0 }),
  JSON.stringify({
    data: emptyLocalData(),
    revision: Number.MAX_SAFE_INTEGER + 1,
  }),
  JSON.stringify({ data: { version: 1 }, revision: 1 }),
  'x'.repeat(MAX_WORKSPACE_BYTES + 1),
]) {
  test(`corrupt stored record is never replaced (${raw.slice(0, 35)})`, async () => {
    const storage = memory(raw);
    const request = createLocalRequest(storage, serialLocks());
    assert.equal((await request()).status, 422);
    assert.equal((await request(put())).status, 422);
    assert.equal(storage.getItem(), raw);
  });
}

test('invalid PUT bodies, types, revisions and relationships never write', async () => {
  const storage = memory();
  const request = createLocalRequest(storage, serialLocks());
  for (const body of [
    '{',
    'null',
    '{}',
    JSON.stringify({ data: emptyLocalData(), revision: -1 }),
    JSON.stringify({ data: emptyLocalData(), revision: 0.5 }),
    JSON.stringify({ data: emptyLocalData(), revision: '0' }),
    JSON.stringify({
      data: emptyLocalData(),
      revision: Number.MAX_SAFE_INTEGER,
    }),
    JSON.stringify({
      data: {
        ...emptyLocalData(),
        milestones: [
          {
            id: 'm',
            projectId: 'missing',
            title: 'x',
            due: '',
            achieved: false,
          },
        ],
      },
      revision: 0,
    }),
  ]) {
    assert.equal((await request({ ...put(), body })).status, 400);
  }
  assert.equal(
    (await request({ ...put(), body: new Blob(['{}']) })).status,
    400,
  );
  assert.equal((await request({ ...put(), headers: {} })).status, 415);
  assert.equal((await request({ method: 'DELETE' })).status, 405);
  assert.equal(
    (await request({ ...put(), body: '가'.repeat(MAX_WORKSPACE_BYTES) }))
      .status,
    413,
  );
  assert.equal(storage.getItem(), null);
});

test('quota, blocked storage, and lock rejection return actionable errors', async () => {
  const raw = JSON.stringify({ data: emptyLocalData(), revision: 1 });
  const quota = {
    getItem: () => raw,
    setItem: () => {
      throw new DOMException('private', 'QuotaExceededError');
    },
  };
  const quotaResponse = await createLocalRequest(
    quota,
    serialLocks(),
  )(put(projectData(), 1));
  assert.equal(quotaResponse.status, 507);
  assert.match((await quotaResponse.json()).error, /백업/);
  assert.equal(quota.getItem(), raw);
  const denied = {
    getItem: () => {
      throw new Error('sensitive');
    },
    setItem: () => {},
  };
  const deniedResponse = await createLocalRequest(denied, serialLocks())();
  assert.equal(deniedResponse.status, 503);
  assert.doesNotMatch(JSON.stringify(await deniedResponse.json()), /sensitive/);
  assert.equal(
    (
      await createLocalRequest(memory(), {
        request: () => Promise.reject(new Error('lock')),
      })(put())
    ).status,
    503,
  );
});

test('browser wrapper is lazy and fails safely without browser globals', async () => {
  assert.equal((await localWorkspaceRequest()).status, 503);
});
