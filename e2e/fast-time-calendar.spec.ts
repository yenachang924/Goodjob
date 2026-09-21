import { expect, test, type Page } from '@playwright/test';

const storageKey = 'cockpit.local-workspace.v2';
const koreanDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });
const day = (offset = 0) => koreanDate.format(Date.now() + offset * 86_400_000);

async function navigate(page: Page, name: string) {
  await expect(
    page.getByRole('heading', { name: '프로젝트 관제판', exact: true }),
  ).toBeVisible();
  const toggle = page.getByRole('button', { name: '프로젝트 목록 펼치기' });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('tab', { name, exact: true }).click();
}

async function capture(page: Page, title: string) {
  const input = page.getByRole('textbox', {
    name: '빠른 할 일 입력',
    exact: true,
  });
  await input.fill(title);
  await input.press('Enter');
  await expect(input).toHaveValue('');
}

test('manual hours and minutes save as ninety minutes and survive reload without precision loss', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, '오늘');
  await capture(page, '수학 복습');
  await navigate(page, '시간 기록');
  await page
    .getByRole('button', { name: '수동 기록 추가', exact: true })
    .click();
  await page.getByLabel('기록 날짜', { exact: true }).fill(day(-1));
  await page
    .getByRole('spinbutton', { name: '기록 시간', exact: true })
    .fill('1');
  await page
    .getByRole('spinbutton', { name: '기록 분', exact: true })
    .fill('30');
  await page
    .getByRole('combobox', { name: '작업', exact: true })
    .selectOption({ label: '수학 복습' });
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  const row = page.getByRole('button', { name: /수학 복습.*1시간 30분/ });
  await expect(row).toBeVisible();
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).data.sessions[0],
    storageKey,
  );
  expect(before.endedAt - before.startedAt).toBe(90 * 60_000);
  await page.reload();
  await navigate(page, '시간 기록');
  await expect(row).toBeVisible();
  await row.click();
  await expect(
    page.getByRole('spinbutton', { name: '기록 시간', exact: true }),
  ).toHaveValue('1');
  await expect(
    page.getByRole('spinbutton', { name: '기록 분', exact: true }),
  ).toHaveValue('30');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '기록 저장', exact: true }),
  ).toHaveCount(0);
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).data.sessions[0],
    storageKey,
  );
  expect(after).toEqual(before);
});

test('calendar capture keeps its scheduled day and top timer controls persist a session', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, '오늘');
  const tomorrow = day(1);
  await expect(
    page.getByRole('region', { name: '할 일 캘린더' }),
  ).toBeVisible();
  const futureCell = page.getByRole('button', {
    name: new RegExp(`^${tomorrow} 할 일`),
  });
  if ((await futureCell.count()) === 0)
    await page.getByRole('button', { name: '다음 달', exact: true }).click();
  await futureCell.click();
  await page.locator('.planning-details > summary').click();
  await expect(page.getByLabel('계획 날짜', { exact: true })).toHaveValue(
    tomorrow,
  );
  await page.locator('.planning-details > summary').click();
  await capture(page, '내일 구현');
  await expect(
    page.getByRole('checkbox', { name: '내일 구현 완료' }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).data,
    storageKey,
  );
  expect(saved.tasks[0]).toMatchObject({
    title: '내일 구현',
    scheduledFor: tomorrow,
    due: '',
    minutes: 0,
  });
  await page.getByRole('button', { name: '오늘로', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: '내일 구현 완료' }),
  ).toHaveCount(0);
  await page
    .getByRole('combobox', { name: '측정할 할 일', exact: true })
    .selectOption(saved.tasks[0].id);
  await page.getByRole('button', { name: '타이머 시작', exact: true }).click();
  await expect(page.getByText('지금 기록 중', { exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        (key) =>
          Date.now() -
          JSON.parse(localStorage.getItem(key)!).data.sessions[0].startedAt,
        storageKey,
      ),
    )
    .toBeGreaterThan(1000);
  await page.getByRole('button', { name: '타이머 종료', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '타이머 시작', exact: true }),
  ).toBeVisible();
  await page.reload();
  const restored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).data,
    storageKey,
  );
  expect(restored.tasks[0].scheduledFor).toBe(tomorrow);
  expect(restored.sessions).toHaveLength(1);
  expect(restored.sessions[0].endedAt).toBeGreaterThan(
    restored.sessions[0].startedAt,
  );
});

test('today restores chosen activity and shows a derived completed parent and deadline separately', async ({
  page,
}) => {
  const today = day();
  const tomorrow = day(1);
  await page.addInitScript(
    ({ key, today, tomorrow }) => {
      if (localStorage.getItem(key)) return;
      const base = {
        projectId: 'class-math',
        parentId: null,
        milestoneId: null,
        minutes: 0,
        priority: 2,
        due: '',
        status: 'todo',
        blockedReason: '',
        createdAt: null,
        completedAt: null,
        archived: false,
      };
      localStorage.setItem(
        key,
        JSON.stringify({
          revision: 1,
          data: {
            version: 2,
            projects: [
              {
                id: 'class-math',
                name: '일반수학2',
                description: '',
                link: '',
                archived: false,
                area: 'class',
              },
            ],
            tasks: [
              {
                ...base,
                id: 'parent',
                title: '수학 단원',
                scheduledFor: today,
              },
              {
                ...base,
                id: 'child',
                title: '단원 연습',
                parentId: 'parent',
                status: 'done',
                completedAt: Date.now() - 1000,
              },
              {
                ...base,
                id: 'deadline',
                title: '마감 확인',
                due: today,
                scheduledFor: tomorrow,
              },
            ],
            milestones: [],
            sessions: [],
            days: {},
            legacyActive: [],
          },
        }),
      );
      localStorage.setItem('cockpit.capture.last-project', 'class-math');
    },
    { key: storageKey, today, tomorrow },
  );
  await page.goto('/');
  await navigate(page, '오늘');
  await expect(
    page.getByRole('combobox', { name: '빠른 기록 소속' }),
  ).toHaveValue('class-math');
  const completed = page.getByRole('checkbox', { name: '수학 단원 완료' });
  await expect(completed).toBeChecked();
  await expect(completed).toBeDisabled();
  await expect(
    page.locator('.day-task').filter({ hasText: '마감 확인' }),
  ).toContainText('마감');
  await capture(page, '이어 할 복습');
  const tasks = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).data.tasks,
    storageKey,
  );
  expect(
    tasks.find((task: { title: string }) => task.title === '이어 할 복습'),
  ).toMatchObject({ projectId: 'class-math', scheduledFor: today });
});
