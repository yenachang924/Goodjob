import { expect, test, type Page } from '@playwright/test';

const storageKey = 'cockpit.local-workspace.v2';

async function openLocal(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '프로젝트 관제판', exact: true }),
  ).toBeVisible();
}

async function addProject(page: Page, name: string) {
  await openNavigation(page);
  await page
    .getByRole('button', { name: '전체 프로젝트', exact: true })
    .click();
  await page.getByRole('button', { name: '프로젝트 추가' }).click();
  await page.getByLabel('프로젝트 이름').fill(name);
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(
    page.getByRole('button', { name: `${name} 열기` }).last(),
  ).toBeVisible();
}

async function openNavigation(page: Page) {
  await expect(
    page.getByRole('heading', { name: '프로젝트 관제판', exact: true }),
  ).toBeVisible();
  const storage = page.locator('.storage-tools[open] > summary');
  if (await storage.isVisible()) await storage.click();
  const toggle = page.getByRole('button', { name: '프로젝트 목록 펼치기' });
  if (await toggle.isVisible()) await toggle.click();
}

async function openProject(page: Page, name: string) {
  await openNavigation(page);
  await page
    .getByRole('button', { name: `${name} 열기` })
    .first()
    .click();
}

test('opens an empty local workspace without any auth or workspace API requests', async ({
  page,
}, info) => {
  const forbidden: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.hostname.endsWith('.supabase.co') ||
      /^\/(auth\/v1|api\/workspace)(\/|$)/.test(url.pathname)
    )
      forbidden.push(request.url());
  });
  await openLocal(page);
  await page.getByText('저장 · 백업', { exact: true }).click();
  await expect(
    page.getByText('이 브라우저에 저장', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('이메일')).toHaveCount(0);
  await addProject(page, '내 첫 프로젝트');
  await expect(
    page.getByText('이 브라우저에 저장됨', { exact: true }),
  ).toBeAttached();
  await page.reload();
  await openNavigation(page);
  await expect(
    page
      .locator('.project-card')
      .getByRole('button', { name: '내 첫 프로젝트 열기' }),
  ).toBeVisible();
  expect(forbidden).toEqual([]);
  await page.screenshot({
    path: info.outputPath('local-workspace.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('persists milestones subtasks and timer records across reload', async ({
  page,
}) => {
  await openLocal(page);
  await addProject(page, '학기 프로젝트');
  await openProject(page, '학기 프로젝트');
  await page.getByRole('button', { name: '마일스톤', exact: true }).click();
  await page.getByLabel('마일스톤 이름').fill('중간 시연');
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  for (const title of ['프로토콜 초안', '메시지 형식 구현']) {
    await page.getByRole('button', { name: '작업 추가' }).click();
    await page.getByLabel('작업 이름').fill(title);
    await page.getByLabel('예상 시간').fill('30');
    await page
      .getByRole('combobox', { name: '마일스톤', exact: true })
      .selectOption({ label: '중간 시연' });
    if (title === '메시지 형식 구현')
      await page
        .getByRole('combobox', { name: '상위 작업', exact: true })
        .selectOption({ label: '프로토콜 초안' });
    await page.getByRole('button', { name: '작업 저장' }).click();
  }
  await page
    .getByRole('button', { name: '메시지 형식 구현 타이머 시작' })
    .click();
  await expect(page.getByText('지금 기록 중')).toBeVisible();
  await page.reload();
  await expect(page.getByText('지금 기록 중')).toBeVisible();
  await page.getByRole('button', { name: '타이머 종료' }).click();
  await openProject(page, '학기 프로젝트');
  await page.locator('.project-secondary > summary').click();
  await expect(
    page.getByRole('heading', { name: '중간 시연', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('메시지 형식 구현', { exact: true }),
  ).toBeVisible();
  await openNavigation(page);
  await page.getByRole('tab', { name: '시간 기록' }).click();
  await expect(
    page.getByRole('button', { name: /메시지 형식 구현/ }),
  ).toBeVisible();
});

test('isolates browser contexts and restores a JSON backup into an empty browser', async ({
  page,
  browser,
}) => {
  await openLocal(page);
  await addProject(page, '내보낼 프로젝트');
  await page.getByText('저장 · 백업', { exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '내보내기' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const other = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  try {
    const second = await other.newPage();
    await openLocal(second);
    await expect(
      second
        .locator('.project-card')
        .getByRole('button', { name: '내보낼 프로젝트 열기' }),
    ).toHaveCount(0);
    await second.locator('input[type=file]').setInputFiles(path!);
    await openNavigation(second);
    await expect(
      second
        .locator('.project-card')
        .getByRole('button', { name: '내보낼 프로젝트 열기' }),
    ).toBeVisible();
    await second.reload();
    await openNavigation(second);
    await expect(
      second
        .locator('.project-card')
        .getByRole('button', { name: '내보낼 프로젝트 열기' }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});

test('rejects a stale tab save and keeps its unsaved draft', async ({
  page,
  context,
}) => {
  await openLocal(page);
  await addProject(page, '공통 프로젝트');
  const stale = await context.newPage();
  await openLocal(stale);
  await openNavigation(stale);
  await stale
    .getByRole('button', { name: '전체 프로젝트', exact: true })
    .click();
  await stale.getByRole('button', { name: '프로젝트 추가' }).click();
  await stale.getByLabel('프로젝트 이름').fill('오래된 탭 초안');
  await addProject(page, '최신 변경');
  await stale.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(
    stale.getByRole('alert').filter({ hasText: /다른 탭|변경/ }),
  ).toBeVisible();
  await expect(stale.getByLabel('프로젝트 이름')).toHaveValue('오래된 탭 초안');
  await page.reload();
  await openNavigation(page);
  await expect(
    page
      .locator('.project-card')
      .getByRole('button', { name: '최신 변경 열기' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '오래된 탭 초안 열기' }),
  ).toHaveCount(0);
});

test('does not overwrite corrupt stored data when loading fails', async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, '{broken-json'),
    storageKey,
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '워크스페이스를 열 수 없습니다' }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    /손상|형식|읽/,
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe('{broken-json');
});

test('quota failure preserves the existing save and the editable draft', async ({
  page,
}) => {
  await openLocal(page);
  await addProject(page, '보존할 프로젝트');
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  );
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, storageKey);
  await page.getByRole('button', { name: '프로젝트 추가' }).click();
  await page.getByLabel('프로젝트 이름').fill('보존할 초안');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    /용량|저장 공간/,
  );
  await expect(page.getByLabel('프로젝트 이름')).toHaveValue('보존할 초안');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(before);
});

test('blocked browser storage shows an actionable error rather than an empty workspace', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) {
      if (name === key) throw new DOMException('Blocked', 'SecurityError');
      return original.call(this, name);
    };
  }, storageKey);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '워크스페이스를 열 수 없습니다' }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    /저장|차단/,
  );
  await expect(page.getByRole('button', { name: '프로젝트 추가' })).toHaveCount(
    0,
  );
});
