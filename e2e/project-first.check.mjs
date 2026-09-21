import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.addInitScript(() => {
      const projects = ['class', 'project', 'study'].map((area) => ({
        id: area,
        name: `${area} 활동`,
        area,
        description: '',
        link: '',
        archived: false,
      }));
      const tasks = projects.map((p) => ({
        id: `task-${p.id}`,
        projectId: p.id,
        title: `${p.id} 다음 할 일`,
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
      }));
      localStorage.setItem(
        'cockpit.local-workspace.v2',
        JSON.stringify({
          revision: 1,
          data: {
            version: 2,
            projects,
            tasks,
            milestones: [],
            sessions: [],
            days: {},
            legacyActive: [],
          },
        }),
      );
    });
    await page.goto('http://127.0.0.1:3000/');
    await expect(page.locator('#overview-title')).toHaveText('병행 중인 활동');
    for (const [area, label] of [
      ['class', '수업'],
      ['project', '프로젝트'],
      ['study', '개인공부'],
    ]) {
      await expect(
        page.getByRole('region', { name: `${label} 활동`, exact: true }),
      ).toContainText(`${area} 다음 할 일`);
    }
    const toggle = page.getByRole('button', {
      name: '프로젝트 목록 펼치기',
      exact: true,
    });
    if (await toggle.isVisible()) await toggle.click();
    await expect(page.getByRole('tab', { name: '내 활동', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '전체 프로젝트', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await page.getByRole('tab', { name: '오늘', exact: true }).click();
    await expect(page.locator('.month-calendar')).toBeVisible();
    await expect(page.getByText('하나씩 적고, 바로 시작하세요.')).toHaveCount(
      0,
    );
    await page.reload();
    await expect(page.locator('#overview-title')).toHaveText('병행 중인 활동');
    await page.close();
  }
} finally {
  await browser.close();
}
