import { test, expect } from '@playwright/test';
import * as fs from 'fs/promises';
import { PageManager } from '../../../pages/page-manager';
import { loginAsUser } from '../../../helpers/auth';
import { loggedExpect, setupAssertionLogging, endAssertionLogging } from '../../../helpers/expect-logger';

// Functional coverage for the left navigation/menu on the dashboard: confirms
// nav items render with expected labels. For pixel-level regression, see
// visual-leftmenu.spec.ts.
test.describe('@smoke UI - Left menu navigation', () => {
  test('should render the left menu and core navigation items', async ({ page, baseURL }) => {
    setupAssertionLogging('should render the left menu and core navigation items');
    if (!baseURL) throw new Error('baseURL is not defined');

    const dashboard = await test.step('Authenticate and load the dashboard', async (testInfo) => {
      const tempStoragePath = `/tmp/auth-${testInfo.testId || 'left-menu'}.json`;
      await loginAsUser(page, baseURL, tempStoragePath, { userPrefix: 'UI' });

      const dashboard = new PageManager(page).dashboard();
      await dashboard.waitForLoad();

      // Clean up after step
      await fs.rm(tempStoragePath, { force: true }).catch(() => {});
      return dashboard;
    });

    await test.step('Verify the left menu renders core navigation items', async () => {
      const navTexts = await dashboard.getNavigationTexts();
      loggedExpect(navTexts.length, 'navTexts.length').toBeGreaterThan(0);
      loggedExpect(navTexts.some(text => /logout/i.test(text)), 'logout in nav').toBeTruthy();
      endAssertionLogging('passed');
    });
  });
});
