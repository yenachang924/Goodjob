import { test, expect } from '@playwright/test';

test('root dashboard links to the isolated learning screen', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: '백엔드 학습실' }).click();
  await expect(
    page.getByRole('heading', { name: '백엔드 학습실' }),
  ).toBeVisible();
});

test('isolated learning UI creates, edits, completes and clears credentials', async ({
  page,
}) => {
  let tasks: Array<Record<string, unknown>> = [];
  await page.route('**/api/learn/tasks**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({
        json: {
          success: true,
          data: tasks,
          meta: { total: tasks.length, page: 0, limit: 20 },
        },
      });
      return;
    }
    const task = {
      ...request.postDataJSON(),
      id: '594e4cfc-84f3-4455-967e-84424b5f87ae',
      revision: (Number(tasks[0]?.revision) || 0) + 1,
    };
    tasks = [task];
    await route.fulfill({
      status: request.method() === 'POST' ? 201 : 200,
      json: { success: true, data: task },
    });
  });
  await page.goto('/learn/tasks');
  await expect(
    page.getByRole('heading', { name: '백엔드 학습실' }),
  ).toBeVisible();
  await page.getByLabel('학습 계정').fill('learner');
  await page.getByLabel('학습 비밀번호').fill('ui-test-only-password');
  await page.getByRole('button', { name: '학습 서버 연결' }).click();
  await expect(page.getByText('등록된 할 일이 없습니다.')).toBeVisible();
  await page.getByLabel('프로젝트', { exact: true }).fill('백엔드 학습');
  await page.getByLabel('할 일 제목').fill('트랜잭션 공부');
  await page.getByRole('button', { name: '할 일 저장', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '트랜잭션 공부', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '트랜잭션 공부 수정' }).click();
  await page.getByLabel('할 일 제목').fill('트랜잭션 테스트');
  await page.getByRole('button', { name: '수정 저장', exact: true }).click();
  await page.getByLabel('할 일 제목').fill('아직 저장하지 않은 초안');
  await page.getByRole('button', { name: '트랜잭션 테스트 완료 처리' }).click();
  await expect(
    page.getByText('완료됨 · revision 3', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('할 일 제목')).toHaveValue(
    '아직 저장하지 않은 초안',
  );
  expect(
    await page.evaluate(() => Object.values(localStorage).join('')),
  ).not.toContain('ui-test-only-password');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole('button', { name: '학습 서버 연결' }),
  ).toBeVisible();
  await expect(page.getByLabel('학습 비밀번호')).toHaveValue('');
});

test('connection failures remain actionable without revealing credentials', async ({
  page,
}) => {
  await page.route('**/api/learn/tasks**', (route) =>
    route.fulfill({
      status: 401,
      json: {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '계정과 비밀번호를 확인하세요.',
        },
      },
    }),
  );
  await page.goto('/learn/tasks');
  await page.getByLabel('학습 계정').fill('learner');
  await page.getByLabel('학습 비밀번호').fill('wrong-test-password');
  await page.getByRole('button', { name: '학습 서버 연결' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: '계정과 비밀번호' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '학습 서버 연결' }),
  ).toBeEnabled();
});

test('completing another task preserves an existing task edit', async ({
  page,
}) => {
  const first = {
    id: '594e4cfc-84f3-4455-967e-84424b5f87ae',
    revision: 1,
    project: '학습',
    title: '첫 할 일',
    minutes: 30,
    priority: 2,
    due: '',
    done: false,
  };
  const second = {
    ...first,
    id: '694e4cfc-84f3-4455-967e-84424b5f87ae',
    title: '다른 할 일',
  };
  let tasks = [first, second];
  await page.route('**/api/learn/tasks**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          success: true,
          data: tasks,
          meta: { total: 2, page: 0, limit: 20 },
        },
      });
    } else {
      const updated = {
        ...second,
        ...route.request().postDataJSON(),
        revision: 2,
      };
      tasks = [first, updated];
      await route.fulfill({ json: { success: true, data: updated } });
    }
  });
  await page.goto('/learn/tasks');
  await page.getByLabel('학습 계정').fill('learner');
  await page.getByLabel('학습 비밀번호').fill('ui-test-only-password');
  await page.getByRole('button', { name: '학습 서버 연결' }).click();
  await page.getByRole('button', { name: '첫 할 일 수정' }).click();
  await page.getByLabel('할 일 제목').fill('수정 중인 내용');
  await page.getByRole('button', { name: '다른 할 일 완료 처리' }).click();
  await expect(
    page.getByText('완료됨 · revision 2', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('할 일 제목')).toHaveValue('수정 중인 내용');
  await expect(
    page.getByRole('button', { name: '수정 저장', exact: true }),
  ).toBeVisible();
});
