import { test, expect } from '@playwright/test';

test('real Next proxy, Kotlin API and DB persist the task lifecycle', async ({
  page,
  request,
}) => {
  const title = `실제 SQL 검증 ${Date.now()}`;
  const username = process.env.GOODJOB_USERNAME!;
  const password = process.env.GOODJOB_PASSWORD!;
  const findSavedTask = async () => {
    const heading = page.getByRole('heading', { name: title, exact: true });
    await expect(
      page.getByRole('button', { name: '새로고침', exact: true }),
    ).toBeEnabled();
    for (
      let visited = 0;
      visited < 100 && !(await heading.isVisible());
      visited++
    ) {
      const next = page.getByRole('button', { name: '다음', exact: true });
      if (!(await next.isEnabled())) break;
      await next.click();
      await expect(
        page.getByRole('button', { name: '새로고침', exact: true }),
      ).toBeEnabled();
    }
    await expect(heading).toBeVisible();
  };
  const anonymous = await request.get('/api/learn/tasks');
  expect(anonymous.status()).toBe(401);
  await page.goto('/learn/tasks');
  const connect = async () => {
    await page.getByLabel('학습 계정').fill(username);
    await page.getByLabel('학습 비밀번호').fill(password);
    await page.getByRole('button', { name: '학습 서버 연결' }).click();
    await expect(page.getByRole('button', { name: '연결 해제' })).toBeVisible();
  };
  await connect();
  await page.getByLabel('프로젝트', { exact: true }).fill('통합 테스트');
  await page.getByLabel('할 일 제목').fill(title);
  await page.getByRole('button', { name: '할 일 저장', exact: true }).click();
  await findSavedTask();
  await page
    .getByRole('button', { name: `${title} 수정`, exact: true })
    .click();
  await page.getByLabel('예상 시간 · 분').fill('45');
  await page.getByRole('button', { name: '수정 저장', exact: true }).click();
  await page
    .getByRole('button', { name: `${title} 완료 처리`, exact: true })
    .click();
  const row = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await expect(row).toContainText('완료됨 · revision 3');
  await page.reload();
  await connect();
  await findSavedTask();
  await expect(row).toContainText('45분');
  await expect(row).toContainText('완료됨 · revision 3');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
