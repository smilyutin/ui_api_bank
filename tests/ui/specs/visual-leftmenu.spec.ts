import { test, expect } from '@playwright/test';
import { DashboardPage } from '../page-objects/dashboard.page';
import { ensureDashboardAuthenticated } from '../helpers/auth-bootstrap';

// Visual regression coverage for the left navigation/menu on the dashboard.
test.describe('UI - Left menu visual coverage', () => {
  test('should render the left menu and core navigation items', async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    await ensureDashboardAuthenticated(page, {
      baseURL: baseURL.toString(),
      role: 'user',
      fallbackUserPrefix: 'UI',
      requireToken: true,
    });

    const dashboard = new DashboardPage(page);
    await dashboard.waitForLoad();

    const navTexts = await dashboard.getNavigationTexts();
    expect(navTexts.length).toBeGreaterThan(0);
    expect(navTexts.some(text => /logout/i.test(text))).toBeTruthy();
  });
});
