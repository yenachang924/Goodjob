import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.addInitScript(() => {
      if (localStorage.getItem('cockpit.local-workspace.v2')) return;
      const base = {
        projectId: 'p',
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
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        ...base,
        id: `t${i}`,
        title: `작업 ${i + 1}`,
      }));
      localStorage.setItem(
        'cockpit.local-workspace.v2',
        JSON.stringify({
          revision: 1,
          data: {
            version: 2,
            projects: [
              {
                id: 'p',
                name: '논리회로',
                area: 'class',
                description: '',
                link: '',
                archived: false,
              },
            ],
            tasks: [
              ...tasks,
              { ...base, id: 'child', parentId: 't0', title: '하위 복습' },
              {
                ...base,
                id: 'done',
                title: '마친 작업',
                status: 'done',
                completedAt: Date.now() - 1000,
              },
            ],
            milestones: [],
            sessions: [],
            days: {},
            legacyActive: [],
          },
        }),
      );
    });
    await page.goto('http://127.0.0.1:3000/');
    const card = page.locator('.project-card').filter({ hasText: '논리회로' });
    await expect(card.getByText('작업 5', { exact: true })).toBeVisible();
    await expect(card.getByText('작업 1', { exact: true })).toBeVisible();
    await expect(card.getByText('하위 복습', { exact: true })).toBeVisible();
    await expect(card.getByText('마친 작업', { exact: true })).toBeHidden();
    await expect(
      page.getByRole('tab', { name: '내 활동', exact: true }),
    ).toHaveCount(0);
    const input = card.getByRole('textbox', {
      name: '논리회로 할 일 입력',
      exact: true,
    });
    await input.fill('바로 추가');
    await input.press('Enter');
    await expect(card.getByText('바로 추가', { exact: true })).toBeVisible();
    await expect(input).toBeFocused();
    await card
      .getByRole('checkbox', { name: '논리회로 · 작업 5 완료', exact: true })
      .click();
    await expect(card.getByText('작업 5', { exact: true })).toBeHidden();
    await card.locator('summary').filter({ hasText: '완료' }).click();
    await expect(card.getByText('작업 5', { exact: true })).toBeVisible();
    await page.screenshot({
      path: `../work/checklist-${width}.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(card.getByText('바로 추가', { exact: true })).toBeVisible();
    await page.close();
  }
} finally {
  await browser.close();
}
