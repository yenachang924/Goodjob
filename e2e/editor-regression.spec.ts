import { expect, test, type Page } from '@playwright/test';

async function openProject(page: Page, name: string) {
  await page.goto('/');
  await page.getByLabel('이메일').fill('test-owner@example.test');
  await page.getByLabel('비밀번호').fill('fixture-password');
  const authenticated = page.waitForResponse((response) => response.url().includes('/auth/v1/token'));
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  const start = page.getByRole('button', { name: '새 워크스페이스 시작' });
  await expect(page.getByRole('heading', { name: '프로젝트 관제판', exact: true }).or(start)).toBeVisible();
  // Each test owns the local fixture workspace; never use hosted credentials here.
  const { access_token: token } = await (await authenticated).json();
  const headers = { Authorization: `Bearer ${token}`, Origin: 'http://127.0.0.1:5321' };
  const snapshot = await page.request.get('/api/workspace', { headers });
  const { revision } = await snapshot.json();
  const reset = await page.request.put('/api/workspace', {
    headers,
    data: { revision, data: { version: 2, projects: [], tasks: [], milestones: [], sessions: [], days: {}, legacyActive: [] } },
  });
  expect(reset.ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '프로젝트 추가' })).toBeVisible();
  await page.getByRole('button', { name: '프로젝트 추가' }).click();
  await page.getByLabel('프로젝트 이름').fill(name);
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await page.getByRole('button', { name: `${name} 열기` }).click();
}

async function addMilestone(page: Page, title: string) {
  await page.getByRole('button', { name: '마일스톤', exact: true }).click();
  await page.getByLabel('마일스톤 이름').fill(title);
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(page.getByLabel('마일스톤 이름')).toBeHidden();
}

async function addTask(page: Page, title: string) {
  await page.getByRole('button', { name: '작업 추가' }).click();
  await page.getByLabel('작업 이름').fill(title);
  await page.getByRole('button', { name: '작업 저장' }).click();
  await expect(page.getByLabel('작업 이름')).toBeHidden();
}

test('milestone draft cannot switch targets until saved or cancelled', async ({ page }, info) => {
  await openProject(page, `milestone-editor-${info.project.name}`);
  await addMilestone(page, '첫 목표');
  await addMilestone(page, '둘째 목표');
  const first = page.locator('.milestone-strip article').filter({ hasText: '첫 목표' });
  const second = page.locator('.milestone-strip article').filter({ hasText: '둘째 목표' });
  await first.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByLabel('마일스톤 이름').fill('보존할 목표 초안');
  await expect(second.getByRole('button', { name: '수정', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(page.getByLabel('마일스톤 이름')).toBeHidden();
  await second.getByRole('button', { name: '수정', exact: true }).click();
  await expect(page.getByLabel('마일스톤 이름')).toHaveValue('둘째 목표');
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.locator('.milestone-strip')).toContainText('보존할 목표 초안');
});

test('task draft cannot switch targets until saved or cancelled', async ({ page }, info) => {
  await openProject(page, `task-editor-${info.project.name}`);
  await addTask(page, '첫 작업');
  await addTask(page, '둘째 작업');
  const first = page.locator('.control-task').filter({ hasText: '첫 작업' });
  const second = page.locator('.control-task').filter({ hasText: '둘째 작업' });
  await first.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByLabel('작업 이름').fill('보존할 작업 초안');
  await expect(second.getByRole('button', { name: '수정', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '작업 저장' }).click();
  await expect(page.getByLabel('작업 이름')).toBeHidden();
  await second.getByRole('button', { name: '수정', exact: true }).click();
  await expect(page.getByLabel('작업 이름')).toHaveValue('둘째 작업');
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.locator('.control-task-list')).toContainText('보존할 작업 초안');
});

test('a child inherits an explicitly unassigned parent milestone', async ({ page }, info) => {
  await openProject(page, `parent-milestone-${info.project.name}`);
  await addMilestone(page, '임시 목표');
  await addTask(page, '목표 없는 부모');
  await page.getByRole('button', { name: '작업 추가' }).click();
  await page.getByLabel('작업 이름').fill('상속할 하위 작업');
  const milestone = page.getByRole('combobox', { name: '마일스톤', exact: true });
  await milestone.selectOption({ label: '임시 목표' });
  await page.getByRole('combobox', { name: '상위 작업', exact: true }).selectOption({ label: '목표 없는 부모' });
  await expect(milestone).toHaveValue('');
  await expect(milestone).toBeDisabled();
  await page.getByRole('button', { name: '작업 저장' }).click();
  await expect(page.getByLabel('작업 이름')).toBeHidden();
  await expect(page.locator('.control-task.child')).toContainText('상속할 하위 작업');
});

test('a historical confirmed plan can be adjusted before decomposing its task', async ({ page }, info) => {
  const name = `past-plan-${info.project.name}`;
  await openProject(page, name);
  await addTask(page, '과거 계획의 부모');
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  const date = page.getByLabel('계획 날짜', { exact: true });
  await expect(date).toBeVisible();
  const today = await date.inputValue();
  await date.fill('2026-01-05');
  await page.getByRole('button', { name: '+ 과거 계획의 부모', exact: true }).click();
  await page.getByRole('button', { name: '이 계획 확정' }).click();
  await expect(page.getByRole('heading', { name: '확정된 계획' })).toBeVisible();
  await date.fill(today);
  await page.getByRole('tab', { name: '전체', exact: true }).click();
  await page.getByRole('button', { name: `${name} 열기` }).click();
  await page.getByRole('button', { name: '작업 추가' }).click();
  await page.getByLabel('작업 이름').fill('분해한 하위 작업');
  await page.getByRole('combobox', { name: '상위 작업', exact: true }).selectOption({ label: '과거 계획의 부모' });
  await page.getByRole('button', { name: '작업 저장' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '계획' })).toBeVisible();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await date.fill('2026-01-05');
  await page.locator('.plan-row').filter({ hasText: '과거 계획의 부모' }).getByRole('button', { name: '제외' }).click();
  await page.getByRole('button', { name: '이 계획 확정' }).click();
  await expect(page.getByRole('heading', { name: '확정된 계획' })).toBeVisible();
  await page.getByRole('tab', { name: '전체', exact: true }).click();
  await page.getByRole('button', { name: `${name} 열기` }).click();
  await page.getByRole('button', { name: '작업 추가' }).click();
  await page.getByLabel('작업 이름').fill('분해한 하위 작업');
  await page.getByRole('combobox', { name: '상위 작업', exact: true }).selectOption({ label: '과거 계획의 부모' });
  await page.getByRole('button', { name: '작업 저장' }).click();
  await expect(page.getByLabel('작업 이름')).toBeHidden();
  await expect(page.locator('.control-task.child')).toContainText('분해한 하위 작업');
});

test('pending plan save locks inputs and navigation until its real response', async ({ page }, info) => {
  await openProject(page, `pending-plan-${info.project.name}`);
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  const capacity = page.getByLabel('등록한 가용시간 · 분', { exact: true });
  await capacity.fill('241');
  let release = () => {};
  let entered = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const requested = new Promise<void>((resolve) => { entered = resolve; });
  await page.route('**/api/workspace', async (route) => {
    if (route.request().method() === 'PUT') {
      entered();
      await held;
    }
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: '이 계획 확정' }).click();
    await requested;
    await expect(capacity).toBeDisabled();
    await expect(page.getByRole('tab', { name: '시간 기록', exact: true })).toBeDisabled();
  } finally {
    release();
  }
  await expect(capacity).toBeEnabled();
  await expect(page.getByRole('tab', { name: '시간 기록', exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await expect(capacity).toHaveValue('241');
});

test('recommendation confirmation persists and overbudget edits preserve the saved plan', async ({ page }, info) => {
  await openProject(page, `recommendation-${info.project.name}`);
  const titles = ['추천 우선 작업', '추천 다음 작업', '추천 제외 막힌 작업'];
  for (const [index, title] of titles.entries()) {
    await page.getByRole('button', { name: '작업 추가' }).click();
    await page.getByLabel('작업 이름').fill(title);
    await page.getByLabel('중요도', { exact: true }).fill('1');
    await page.getByLabel('마감일', { exact: true }).fill(index === 1 ? '2026-01-02' : '2026-01-01');
    if (index === 2) await page.getByRole('combobox', { name: '상태', exact: true }).selectOption('blocked');
    await page.getByRole('button', { name: '작업 저장' }).click();
    await expect(page.getByLabel('작업 이름')).toBeHidden();
  }
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await page.getByLabel('등록한 가용시간 · 분', { exact: true }).fill('70');
  await page.getByLabel('완충시간 · 분', { exact: true }).fill('10');
  await page.getByRole('button', { name: '우선순위로 초안 만들기' }).click();
  await expect(page.locator('.plan-row strong')).toHaveText(titles.slice(0, 2));
  await page.getByRole('button', { name: '이 계획 확정' }).click();
  await expect(page.getByRole('heading', { name: '확정된 계획' })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await expect(page.locator('.plan-row strong')).toHaveText(titles.slice(0, 2));
  await expect(page.locator('.plan-row small')).toHaveText([
    `recommendation-${info.project.name} · 30분`,
    `recommendation-${info.project.name} · 30분`,
  ]);
  await page.getByLabel('등록한 가용시간 · 분', { exact: true }).fill('40');
  await page.getByRole('button', { name: '이 계획 확정' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '입력값' })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await expect(page.getByLabel('등록한 가용시간 · 분', { exact: true })).toHaveValue('70');
  await expect(page.locator('.plan-row strong')).toHaveText(titles.slice(0, 2));
});

test('pending time record save cannot open a replacement draft', async ({ page }, info) => {
  await openProject(page, `pending-time-${info.project.name}`);
  await addTask(page, '시간 기록 잠금 작업');
  await page.getByRole('tab', { name: '시간 기록', exact: true }).click();
  await page.getByRole('button', { name: '수동 기록 추가', exact: true }).click();
  await page.getByRole('combobox', { name: '작업', exact: true }).selectOption({ label: '시간 기록 잠금 작업' });
  await page.getByLabel('시작', { exact: true }).fill('2026-01-03T10:00');
  await page.getByLabel('종료', { exact: true }).fill('2026-01-03T10:30');
  let release = () => {};
  let entered = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const requested = new Promise<void>((resolve) => { entered = resolve; });
  await page.route('**/api/workspace', async (route) => {
    if (route.request().method() === 'PUT') {
      entered();
      await held;
    }
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: '기록 저장', exact: true }).click();
    await requested;
    await expect(page.getByLabel('시작', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '수동 기록 추가', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '취소', exact: true })).toBeDisabled();
  } finally {
    release();
  }
  await expect(page.getByLabel('시작', { exact: true })).toBeHidden();
  await expect(page.locator('.record-row').filter({ hasText: '시간 기록 잠금 작업' })).toContainText('00:30:00');
  await expect(page.getByRole('button', { name: '수동 기록 추가', exact: true })).toBeEnabled();
});

test('future plan dates render zero recorded time without crashing', async ({ page }, info) => {
  await openProject(page, `future-date-${info.project.name}`);
  await page.getByRole('tab', { name: '오늘', exact: true }).click();
  await page.getByLabel('계획 날짜', { exact: true }).fill('2099-01-01');
  await expect(page.getByRole('heading', { name: '2099-01-01 계획' })).toBeVisible();
  await expect(page.locator('.today-summary article').last()).toContainText('00:00:00');
});
