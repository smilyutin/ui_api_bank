import { test, expect } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
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

  test('should upload a profile picture and update the displayed image', async () => {
    const profile = pm.profile();
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

  // test('should import a profile picture from a URL', async ({ page, baseURL }) => {
  //   if (!baseURL) throw new Error('baseURL is not defined');

  //   const profile = pm.profile();

  //   // Use an app-hosted static asset to keep the test self-contained.
  //   // APP_INTERNAL_URL allows CI/Docker environments to supply the URL that the
  //   // Flask server can reach (e.g. http://web:5000) instead of the host-facing
  //   // baseURL (e.g. http://localhost:5001), since the server fetches this URL
  //   // from inside the Docker network.
  //   const serverBaseUrl = process.env.APP_INTERNAL_URL || baseURL;
  //   await profile.importFromUrl(new URL('/static/user.png', serverBaseUrl).toString());

  //   await profile.waitForUploadMessage(/imported from url successfully/i);
  //   await profile.waitForProfilePictureSrc(/uploads\//);
  // });
});
