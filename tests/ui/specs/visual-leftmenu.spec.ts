import { test, expect } from '@playwright/test';
import * as fs from 'fs/promises';
import { PageManager } from '../../../pages/page-manager';
import { loginAsUser } from '../../../helpers/auth';

// Pixel-level visual regression for the left navigation/menu on the dashboard.
// .side-panel is static markup (logo + nav links) with no per-user dynamic
// content (balance/greeting/date live in .main-content, out of frame), so the
// screenshot is deterministic across runs for a given browser/OS. For
// functional coverage of nav item labels, see left-menu-navigation.spec.ts.
test.describe('@ui UI - Left menu visual coverage', () => {
  test('left menu should match its visual baseline', async ({ page, baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    await test.step('Authenticate, load the dashboard, and open the left menu', async () => {
      const tempStoragePath = `/tmp/auth-${testInfo.testId || 'visual-menu'}.json`;
      await loginAsUser(page, baseURL, tempStoragePath, { userPrefix: 'UI' });

      const dashboard = new PageManager(page).dashboard();
      await dashboard.waitForLoad();
      // Open the panel so desktop and mobile projects screenshot the same
      // visible state (mobile starts with .side-panel off-canvas).
      await dashboard.openSidePanel();

      // Clean up after step
      await fs.rm(tempStoragePath, { force: true }).catch(() => {});
    });

    await test.step('Verify it matches the visual baseline', async () => {
      await expect(page.locator('.side-panel')).toHaveScreenshot('left-menu.png');
    });
  });
});
