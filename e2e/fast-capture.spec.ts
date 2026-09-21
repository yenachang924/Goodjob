import { expect, test, type Page } from '@playwright/test';

const key = 'cockpit.local-workspace.v2';

async function openToday(page: Page) {
  await expect(page.locator('#overview-title')).toBeVisible();
  const toggle = page.getByRole('button', {
    name: '프로젝트 목록 펼치기',
    exact: true,
  });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
}

test('inbox task can be assigned to an activity without losing its identity', async ({
  page,
}) => {
  await page.addInitScript((name) => {
    localStorage.setItem(
      name,
      JSON.stringify({
        revision: 1,
        data: {
          version: 2,
          projects: [
            {
              id: 'class',
              name: '논리회로',
              area: 'class',
              description: '',
              link: '',
              archived: false,
            },
          ],
          tasks: [],
          milestones: [],
          sessions: [],
          days: {},
          legacyActive: [],
        },
      }),
    );
  }, key);
  await page.goto('/');
  await openToday(page);
  await expect(
    page.getByRole('heading', { name: '프로젝트 관제판', exact: true }),
  ).toBeVisible();
  const input = page.getByRole('textbox', {
    name: '빠른 할 일 입력',
    exact: true,
  });
  await input.fill('활동 정하기');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  const before = await page.evaluate(
    (name) => JSON.parse(localStorage.getItem(name)!).data.tasks[0],
    key,
  );
  const navigation = page.getByRole('button', {
    name: '프로젝트 목록 펼치기',
    exact: true,
  });
  if (await navigation.isVisible()) await navigation.click();
  await page.getByRole('button', { name: '미분류 열기', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '프로젝트 보관', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('combobox', { name: '활동 정하기 활동으로 이동', exact: true })
    .selectOption('class');
  await expect(
    page.getByRole('combobox', {
      name: '활동 정하기 활동으로 이동',
      exact: true,
    }),
  ).toHaveCount(0);
  const after = await page.evaluate(
    (name) => JSON.parse(localStorage.getItem(name)!).data.tasks[0],
    key,
  );
  expect(after).toEqual({ ...before, projectId: 'class', milestoneId: null });
});

test('activity capture inherits its project and adds a child inline', async ({
  page,
}) => {
  await page.addInitScript((name) => {
    localStorage.setItem(
      name,
      JSON.stringify({
        revision: 1,
        data: {
          version: 2,
          projects: [
            {
              id: 'study',
              name: '논리회로',
              description: '',
              link: '',
              archived: false,
            },
          ],
          tasks: [],
          milestones: [],
          sessions: [],
          days: {},
          legacyActive: [],
        },
      }),
    );
  }, key);
  await page.goto('/');
  await openToday(page);
  await expect(
    page.getByRole('heading', { name: '프로젝트 관제판', exact: true }),
  ).toBeVisible();
  const navigation = page.getByRole('button', { name: '프로젝트 목록 펼치기' });
  if (await navigation.isVisible()) await navigation.click();
  await page
    .getByRole('button', { name: '논리회로 열기', exact: true })
    .first()
    .click();
  const input = page.getByRole('textbox', {
    name: '빠른 할 일 입력',
    exact: true,
  });
  await input.fill('복습');
  await input.press('Enter');
  const child = page.getByRole('textbox', {
    name: '복습 하위 할 일 입력',
    exact: true,
  });
  await child.fill('진리표 작성');
  await child.press('Enter');
  await expect(child).toHaveValue('');
  await expect(
    page.getByRole('checkbox', { name: '진리표 작성 완료' }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (name) => JSON.parse(localStorage.getItem(name)!).data,
    key,
  );
  expect(saved.tasks[1].projectId).toBe('study');
  expect(saved.tasks[1].parentId).toBe(saved.tasks[0].id);
  await page
    .getByRole('button', { name: '프로젝트 수정', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: '영역', exact: true })
    .selectOption('class');
  await page
    .getByRole('button', { name: '프로젝트 저장', exact: true })
    .click();
  const categorized = await page.evaluate(
    (name) => JSON.parse(localStorage.getItem(name)!).data,
    key,
  );
  expect(categorized.projects[0]).toMatchObject({ id: 'study', area: 'class' });
  expect(categorized.tasks).toEqual(saved.tasks);
});

test('title Enter captures consecutively, skips IME, and preserves a failed draft', async ({
  page,
}) => {
  await page.goto('/');
  await openToday(page);
  const input = page.getByRole('textbox', {
    name: '빠른 할 일 입력',
    exact: true,
  });
  await expect(input).toBeVisible();
  await input.fill('논리회로 복습');
  await input.dispatchEvent('compositionstart');
  await input.press('Enter');
  await expect(input).toHaveValue('논리회로 복습');
  await input.dispatchEvent('compositionend');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await input.fill('다음 할 일');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  const saved = await page.evaluate(
    (name) => JSON.parse(localStorage.getItem(name)!).data,
    key,
  );
  expect(saved.tasks.map((task: { title: string }) => task.title)).toEqual([
    '논리회로 복습',
    '다음 할 일',
  ]);
  expect(
    saved.tasks.every((task: { minutes: number }) => task.minutes === 0),
  ).toBe(true);
  await page.evaluate((name) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey === name)
        throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, storageKey, value);
    };
  }, key);
  await input.fill('실패해도 남길 초안');
  await input.press('Enter');
  await expect(input).toHaveValue('실패해도 남길 초안');
  await expect(input).toBeEnabled();
});
