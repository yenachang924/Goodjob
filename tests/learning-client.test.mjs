import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  basicAuthorization,
  parseTaskPage,
  loadTasks,
  saveTask,
  toTaskInput,
} from '../apps/web/features/learning-tasks/client.ts';
test('learning credentials encode UTF-8 and reject username separators', () => {
  assert.equal(
    Buffer.from(
      basicAuthorization('학습', '암호').slice(6),
      'base64',
    ).toString(),
    '학습:암호',
  );
  assert.throws(() => basicAuthorization('user:admin', 'password'));
  assert.throws(() => basicAuthorization('', 'password'));
});
test('learning client preserves revisions, excludes output fields and surfaces conflicts', async () => {
  const task = {
    id: '594e4cfc-84f3-4455-967e-84424b5f87ae',
    revision: 2,
    project: '학습',
    title: 'SQL',
    minutes: 30,
    priority: 2,
    done: false,
    due: '',
  };
  const input = toTaskInput(task);
  assert.equal('revision' in input, false);
  assert.equal('id' in input, false);
  const requests = [];
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options });
    return Response.json({ success: true, data: task });
  });
  try {
    await saveTask('Basic dGVzdDp0ZXN0', input);
    await saveTask('Basic dGVzdDp0ZXN0', input, task);
    assert.equal(requests[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(requests[0].options.body), input);
    assert.equal(requests[1].url, `/api/learn/tasks/${task.id}`);
    assert.equal(requests[1].options.method, 'PUT');
    assert.equal(JSON.parse(requests[1].options.body).revision, 2);
    fetchMock.mock.mockImplementation(async () =>
      Response.json(
        { success: false, error: { message: '다른 화면에서 수정했습니다.' } },
        { status: 409 },
      ),
    );
    await assert.rejects(
      saveTask('Basic dGVzdDp0ZXN0', input, task),
      /다른 화면/,
    );
    fetchMock.mock.mockImplementation(async () => {
      throw new Error('socket internals');
    });
    await assert.rejects(
      loadTasks('Basic dGVzdDp0ZXN0'),
      /학습 서버에 연결하지 못했습니다/,
    );
  } finally {
    fetchMock.mock.restore();
  }
});
test('learning client reports malformed server responses without parser details', async () => {
  const fetchMock = mock.method(
    globalThis,
    'fetch',
    async () => new Response('<html>gateway failure</html>', { status: 502 }),
  );
  try {
    await assert.rejects(
      loadTasks('Basic dGVzdDp0ZXN0'),
      /서버 응답을 읽지 못했습니다/,
    );
  } finally {
    fetchMock.mock.restore();
  }
});
test('learning client rejects malformed API contracts', () => {
  const body = {
    success: true,
    data: [],
    meta: { total: 0, page: 0, limit: 20 },
  };
  assert.deepEqual(parseTaskPage(body), {
    tasks: [],
    total: 0,
    page: 0,
    limit: 20,
  });
  assert.throws(() => parseTaskPage({ ...body, data: [{}] }));
  assert.throws(() => parseTaskPage({ ...body, meta: { total: -1 } }));
});
