import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('이메일').fill('test-owner@example.test');
  await page.getByLabel('비밀번호').fill('fixture-password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(
    page
      .getByRole('heading', { name: '프로젝트 관제판', exact: true })
      .or(page.getByRole('button', { name: '새 워크스페이스 시작' })),
  ).toBeVisible();
}

test('creates one project task and exposes it across the workspace', async ({
  page,
}, info) => {
  const project = `분산 시스템 ${info.project.name}`;
  const parent = `프로토콜 초안 ${info.project.name}`;
  const child = `메시지 형식 구현 ${info.project.name}`;
  await login(page);

  const start = page.getByRole('button', { name: '새 워크스페이스 시작' });
  if (await start.isVisible()) await start.click();

  await page.getByRole('button', { name: '프로젝트 추가' }).click();
  await page.getByLabel('프로젝트 이름').fill(project);
  await page.getByLabel('프로젝트 설명').fill('가을 학기 팀 프로젝트');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();

  await page.getByRole('button', { name: `${project} 열기` }).click();
  await page.getByRole('button', { name: '마일스톤' }).click();
  await page.getByLabel('마일스톤 이름').fill('중간 시연');
  await page.getByRole('button', { name: '마일스톤 저장' }).click();

  await page.getByRole('button', { name: '작업 추가' }).click();
  await page.getByLabel('작업 이름').fill(parent);
  await page.getByLabel('예상 시간').fill('45');
  await page
    .getByRole('combobox', { name: '마일스톤', exact: true })
    .selectOption({ label: '중간 시연' });
  await page.getByRole('button', { name: '작업 저장' }).click();

  await page.getByRole('button', { name: '작업 추가' }).click();
  await page.getByLabel('작업 이름').fill(child);
  await page.getByLabel('예상 시간').fill('30');
  await page
    .getByRole('combobox', { name: '상위 작업', exact: true })
    .selectOption({ label: parent });
  await page.getByRole('button', { name: '작업 저장' }).click();

  await expect(page.getByText(child)).toBeVisible();
  await page.getByRole('button', { name: `${child} 타이머 시작` }).click();
  await expect(page.getByText('지금 기록 중')).toBeVisible();
  await page.getByRole('button', { name: '타이머 종료' }).click();

  await page.reload();
  await expect(page.getByText(project, { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: '전체' }).click();
  await expect(
    page
      .getByRole('article')
      .filter({
        has: page.getByRole('heading', { name: project, exact: true }),
      })
      .getByText('0 / 1 완료'),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('overview.png'),
    fullPage: true,
  });
  await page.getByRole('tab', { name: '오늘' }).click();
  await expect(
    page.getByRole('button', { name: `+ ${child}`, exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: '시간 기록' }).click();
  await expect(page.getByText(project, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: new RegExp(child) }).click();
  await expect(page.getByRole('heading', { name: '기록 수정' })).toBeVisible();
  await page.getByRole('button', { name: '기록 저장' }).click();
  await expect(page.getByRole('heading', { name: '기록 수정' })).toBeHidden();
  await page.getByRole('tab', { name: '전체', exact: true }).click();
  await page.getByRole('button', { name: project + ' 열기' }).click();
  await page.getByLabel(child + ' 상태').selectOption('done');
  await expect(page.getByText('1/1 실행 작업 완료')).toBeVisible();
  await page.getByRole('button', { name: '달성 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '다시 진행' })).toBeVisible();
  await page.getByRole('button', { name: '작업 추가' }).click();
  await page.getByLabel('작업 이름').fill('충돌 시 보존할 초안');
  await page.route('**/api/workspace', async (route) => {
    if (route.request().method() === 'PUT')
      return route.fulfill({
        status: 409,
        json: { error: '다른 탭에서 변경되었습니다.' },
      });
    return route.continue();
  });
  await page.getByRole('button', { name: '작업 저장' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: '다른 탭' }),
  ).toBeVisible();
  await expect(page.getByLabel('작업 이름')).toHaveValue('충돌 시 보존할 초안');
});

test('keeps the primary navigation usable on a narrow screen', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const start = page.getByRole('button', { name: '새 워크스페이스 시작' });
  if (await start.isVisible()) await start.click();
  await expect(
    page.getByRole('tablist', { name: '관제판 보기' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: '오늘' }).click();
  await expect(page.getByRole('heading', { name: '오늘 계획' })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('mobile.png'),
    fullPage: true,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});
