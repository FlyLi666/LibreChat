import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const desktopRoutes = [
  { name: 'chat', path: '/c/new', selector: 'textarea[aria-label="Message input"]' },
  { name: 'image', path: '/image', heading: /Image/ },
  { name: 'notebook', path: '/notebook', heading: /NotebookLM/ },
  { name: 'agent profile', path: '/agent/lobe-ai/profile', heading: /Assistant profile/ },
  { name: 'agent channels', path: '/agent/lobe-ai/channel', heading: /WeChat|Start without setup/ },
  { name: 'agent tasks', path: '/agent/lobe-ai/task', heading: /Tasks/ },
  { name: 'community home', path: '/community', heading: /Community Home/ },
  { name: 'community agents', path: '/community/agent', heading: /Agent/ },
  { name: 'community skills', path: '/community/skill', heading: /Skill/ },
  { name: 'community mcp', path: '/community/mcp', heading: /MCP/ },
];

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const width = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    return width - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectRouteReady(page: Page, route: (typeof desktopRoutes)[number]) {
  await page.goto(route.path, { waitUntil: 'domcontentloaded' });

  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page).toHaveTitle(/^(?!LibreChat$).+/);
  if (route.heading) {
    await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible();
  }
  if (route.selector) {
    await expect(page.locator(route.selector).first()).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
}

test.describe('HeZi menu route matrix', () => {
  for (const route of desktopRoutes) {
    test(`desktop opens ${route.name}`, async ({ page }) => {
      await expectRouteReady(page, route);
    });
  }

  test('mobile keeps key menu destinations usable without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of [
      { name: 'mobile chat', path: '/c/new', selector: 'textarea[aria-label="Message input"]' },
      {
        name: 'mobile channels',
        path: '/agent/lobe-ai/channel',
        heading: /WeChat|Start without setup/,
      },
      { name: 'mobile mcp', path: '/community/mcp', heading: /MCP/ },
    ]) {
      await expectRouteReady(page, route);
    }
  });
});
