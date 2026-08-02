import { test, expect } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';
import { loggedExpect, setupAssertionLogging, endAssertionLogging } from '../../../helpers/expect-logger';

// Visual regression coverage for the left navigation/menu on the dashboard.
test.describe('UI - Left menu visual coverage', () => {
  test('should render the left menu and core navigation items', async ({ page, baseURL }) => {
    setupAssertionLogging('should render the left menu and core navigation items');
    if (!baseURL) throw new Error('baseURL is not defined');

    await ensureDashboardAuthenticated(page, {
      baseURL: baseURL.toString(),
      role: 'user',
      fallbackUserPrefix: 'UI',
      requireToken: true,
    });

    const dashboard = new PageManager(page).dashboard();
    await dashboard.waitForLoad();

    const navTexts = await dashboard.getNavigationTexts();
    loggedExpect(navTexts.length, 'navTexts.length').toBeGreaterThan(0);
    loggedExpect(navTexts.some(text => /logout/i.test(text)), 'logout in nav').toBeTruthy();
    endAssertionLogging('passed');
  });
});
