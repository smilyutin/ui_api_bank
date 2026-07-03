import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../../pages/dashboard.page';
import { ProfilePage } from '../../../pages/profile.page';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';
import { TEST_PNG_BUFFER } from '../../../fixtures/api/profile.helpers';

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
  test.beforeEach(async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    await ensureDashboardAuthenticated(page, {
      baseURL: baseURL.toString(),
      role: 'user',
      fallbackUserPrefix: 'profile-ui',
    });

    const dash = new DashboardPage(page);
    await dash.waitForLoad();
  });

  test('should upload a profile picture and update the displayed image', async ({ page }) => {
    const profile = new ProfilePage(page);
    const initialSrc = await profile.getProfilePictureSrc();

    await profile.uploadPicture({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: TEST_PNG_BUFFER,
    });

    await profile.waitForUploadMessage(/upload successful/i);
    await profile.waitForProfilePictureSrc(/uploads\//);

    const updatedSrc = await profile.getProfilePictureSrc();
    expect(updatedSrc).not.toBe(initialSrc);
  });

  test('should import a profile picture from a URL', async ({ page }) => {
    const profile = new ProfilePage(page);

    // The server fetches this URL itself (not the browser), so it must be
    // reachable from wherever the app is hosted. The app's own baseURL is not
    // a safe substitute here: when the app runs behind a port-mapped
    // container, its externally-facing baseURL is not reachable from inside
    // the container. A stable third-party image keeps this a true test of the
    // real-world "import from a URL" business function.
    await profile.importFromUrl('https://www.google.com/favicon.ico');

    await profile.waitForUploadMessage(/imported from url successfully/i);
    await profile.waitForProfilePictureSrc(/uploads\//);
  });
});
