import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from '@playwright/test';

const fixtureOrigin = 'http://127.0.0.1:55439';
const appOrigin = 'http://127.0.0.1:5321';
const newPassword = 'new-fixture-password-only';

test('completed recovery survives logout failure and refresh without re-saving password', async ({
  page,
  request,
}) => {
  const user = await openRecovery(page, request);
  let updates = 0;
  let failLogout = true;
  await page.route('**/auth/v1/user', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    updates += 1;
    await route.fulfill({ status: 200, json: user });
  });
  await page.route('**/auth/v1/logout**', async (route) => {
    if (!failLogout) return route.continue();
    await route.fulfill({
      status: 500,
      json: {
        code: 'unexpected_failure',
        message: 'Fixture logout unavailable',
      },
    });
  });
  await page.getByLabel('새 비밀번호', { exact: true }).fill(newPassword);
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill(newPassword);
  await page
    .getByRole('button', { name: '비밀번호 변경', exact: true })
    .click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    '로그아웃하지 못했습니다',
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '비밀번호 변경 완료' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '프로젝트 관제판' }),
  ).toBeHidden();
  failLogout = false;
  await page.getByRole('button', { name: '로그인으로 돌아가기' }).click();
  await expect(
    page.getByRole('button', { name: '로그인', exact: true }),
  ).toBeVisible();
  expect(updates).toBe(1);
});

test('loads local Pretendard for text and form controls', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: '로그인', exact: true }),
  ).toBeVisible();
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return ['body', 'input', 'button'].map((selector) => {
      const element = document.querySelector(selector)!;
      const family = getComputedStyle(element).fontFamily.split(',')[0].trim();
      return { family, loaded: document.fonts.check(`16px ${family}`) };
    });
  });
  for (const font of fonts) {
    expect(font.family.toLowerCase()).toContain('pretendard');
    expect(font.loaded).toBe(true);
  }
});

test('recovery rate limit remains actionable without claiming email was sent', async ({
  page,
}) => {
  await page.route('**/auth/v1/recover**', async (route) => {
    await route.fulfill({
      status: 429,
      json: {
        code: 'over_email_send_rate_limit',
        message: 'Fixture rate limited',
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '비밀번호를 잊으셨나요?' }).click();
  await page
    .getByLabel('이메일', { exact: true })
    .fill('test-owner@example.test');
  await page.getByRole('button', { name: '재설정 메일 보내기' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    /잠시|요청/,
  );
  await expect(
    page.getByRole('button', { name: '재설정 메일 보내기' }),
  ).toBeEnabled();
  await expect(page.getByRole('status')).toBeHidden();
});

test('ordinary password login still opens the workspace', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('이메일', { exact: true })
    .fill('test-owner@example.test');
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '로그아웃', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('test-owner@example.test', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '새 비밀번호 설정' }),
  ).toBeHidden();
});

async function openRecovery(page: Page, request: APIRequestContext) {
  const response = await request.post(`${fixtureOrigin}/auth/v1/token`, {
    data: { email: 'test-owner@example.test', password: 'fixture-password' },
  });
  expect(response.ok()).toBe(true);
  const session = await response.json();
  const fragment = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: 'bearer',
    expires_in: '86400',
    type: 'recovery',
  });
  await page.goto(`/#${fragment}`);
  await expect(
    page.getByRole('heading', { name: '새 비밀번호 설정' }),
  ).toBeVisible();
  return session.user;
}

test('requests recovery using the current origin and hides account existence', async ({
  page,
}) => {
  let redirect = '';
  let requestedEmail = '';
  await page.route('**/auth/v1/recover**', async (route) => {
    redirect =
      new URL(route.request().url()).searchParams.get('redirect_to') ?? '';
    requestedEmail = route.request().postDataJSON().email;
    await route.fulfill({ status: 200, json: {} });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '비밀번호를 잊으셨나요?' }).click();
  await page
    .getByLabel('이메일', { exact: true })
    .fill('test-owner@example.test');
  await page.getByRole('button', { name: '재설정 메일 보내기' }).click();
  await expect(page.getByRole('status')).toContainText('등록된 이메일이라면');
  expect(redirect).toBe(`${appOrigin}/`);
  expect(requestedEmail).toBe('test-owner@example.test');
  await expect(
    page.getByRole('button', { name: /초 후 다시 요청/ }),
  ).toBeDisabled();
});

test('expired email links show an actionable retry instead of a silent login screen', async ({
  page,
}) => {
  await page.goto(
    '/#error=access_denied&error_code=otp_expired&error_description=Expired',
  );
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    /만료|유효/,
  );
  await expect(
    page.getByRole('button', { name: '재설정 메일 보내기' }),
  ).toBeVisible();
});

test('valid recovery survives refresh and saves a password before returning to login', async ({
  page,
  request,
}) => {
  const user = await openRecovery(page, request);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '새 비밀번호 설정' }),
  ).toBeVisible();
  let updates = 0;
  await page.route('**/auth/v1/user', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    expect(route.request().postDataJSON().password).toBe(newPassword);
    updates += 1;
    await route.fulfill({ status: 200, json: user });
  });
  await page.getByLabel('새 비밀번호', { exact: true }).fill(newPassword);
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill(newPassword);
  await page
    .getByRole('button', { name: '비밀번호 변경', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '로그인', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText(/변경|새 비밀번호/);
  expect(updates).toBe(1);
  await page.reload();
  await expect(
    page.getByRole('button', { name: '로그인', exact: true }),
  ).toBeVisible();
});

test('mismatching confirmation never submits a password change', async ({
  page,
  request,
}) => {
  await openRecovery(page, request);
  let updates = 0;
  await page.route('**/auth/v1/user', async (route) => {
    if (route.request().method() === 'PUT') updates += 1;
    await route.continue();
  });
  await page.getByLabel('새 비밀번호', { exact: true }).fill(newPassword);
  await page
    .getByLabel('새 비밀번호 확인', { exact: true })
    .fill('different-fixture-password');
  await page
    .getByRole('button', { name: '비밀번호 변경', exact: true })
    .click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    /일치|같/,
  );
  expect(updates).toBe(0);
});

test('server password policy errors keep recovery form available', async ({
  page,
  request,
}) => {
  await openRecovery(page, request);
  await page.route('**/auth/v1/user', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    await route.fulfill({
      status: 422,
      json: {
        code: 'weak_password',
        message: 'Password is too weak',
        weak_password: { reasons: ['length'] },
      },
    });
  });
  await page.getByLabel('새 비밀번호', { exact: true }).fill(newPassword);
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill(newPassword);
  await page
    .getByRole('button', { name: '비밀번호 변경', exact: true })
    .click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    /비밀번호/,
  );
  await expect(
    page.getByRole('heading', { name: '새 비밀번호 설정' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '비밀번호 변경', exact: true }),
  ).toBeEnabled();
});
