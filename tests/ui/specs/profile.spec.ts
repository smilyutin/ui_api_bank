import { test, expect } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';
import { TEST_PNG_BUFFER } from '../../../fixtures/api/profile.helpers';
import { loggedExpect, setupAssertionLogging, endAssertionLogging } from '../../../helpers/expect-logger';

/**
 * Profile Picture Tests (UI)
 *
 * These tests verify that the dashboard's Profile section lets an
 * authenticated user change their profile picture, either by uploading a
 * file or by importing an image from a URL.
 *
 * Test Strategy:
 * 1. Authenticate and load the dashboard.
 * 2. Drive the Profile section through the ProfilePage POM.
 * 3. Verify the success message and the updated <img> src for each flow.
 */
test.describe('Profile picture management', () => {
  let pm: PageManager;

  test.beforeEach(async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    await ensureDashboardAuthenticated(page, {
      baseURL: baseURL.toString(),
      role: 'user',
      fallbackUserPrefix: 'profile-ui',
    });

    pm = new PageManager(page);
    await pm.dashboard().waitForLoad();
  });

  // Test cleanup: Logout and clear session state
  test.afterEach(async ({ page, context }) => {
    try {
      await pm.dashboard().logout().catch(() => {
        // Logout may fail if already logged out, which is fine
      });
    } catch (e) {
      // Silently ignore errors
    }

    try {
      await context.clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch (e) {
      // Silently ignore if page/context already closed
    }
  });

  test('should upload a profile picture and update the displayed image', async () => {
    setupAssertionLogging('should upload a profile picture and update the displayed image');
    const profile = pm.profile();

    const initialSrc = await test.step('Capture the initial picture and upload a new one', async () => {
      const initialSrc = await profile.getProfilePictureSrc();

      await profile.uploadPicture({
        name: 'avatar.png',
        mimeType: 'image/png',
        buffer: TEST_PNG_BUFFER,
      });

      await profile.waitForUploadMessage(/upload successful/i);
      await profile.waitForProfilePictureSrc(/uploads\//);
      return initialSrc;
    });

    await test.step('Verify the displayed image updated', async () => {
      const updatedSrc = await profile.getProfilePictureSrc();
      loggedExpect(updatedSrc, 'updatedSrc').not.toBe(initialSrc);
      endAssertionLogging('passed');
    });
  });

  test('should import a profile picture from a URL', async ({ baseURL }) => {
    setupAssertionLogging('should import a profile picture from a URL');
    const missingInternalUrl = !process.env.APP_INTERNAL_URL;
    test.skip(missingInternalUrl, 'APP_INTERNAL_URL is not set; skipping URL-import test in this environment');
    if (!baseURL) throw new Error('baseURL is not defined');

    const profile = pm.profile();

    await test.step('Import a profile picture from a URL', async () => {
      // Use an app-hosted static asset to keep the test self-contained.
      // APP_INTERNAL_URL allows CI/Docker environments to supply the URL that the
      // Flask server can reach (e.g. http://web:5000) instead of the host-facing
      // baseURL (e.g. http://localhost:5001), since the server fetches this URL
      // from inside the Docker network.
      const serverBaseUrl = process.env.APP_INTERNAL_URL || baseURL;
      await profile.importFromUrl(new URL('/static/user.png', serverBaseUrl).toString());
    });

    await test.step('Verify it was imported successfully', async () => {
      await profile.waitForUploadMessage(/imported from url successfully/i);
      await profile.waitForProfilePictureSrc(/uploads\//);
      endAssertionLogging('passed');
    });
  });
});
