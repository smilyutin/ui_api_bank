import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
import {
  establishAccountSession,
  type AccountSession
} from '../../fixtures/api/transactions.helpers';
import {
  attemptSsrfViaProfileUrlImport,
  importProfilePictureFromUrl,
  uploadProfilePicture
} from '../../fixtures/api/profile.helpers';

/**
 * API Profile Picture Tests
 *
 * These tests exercise the profile picture surfaces:
 *   - POST /upload_profile_picture       (multipart file upload)
 *   - POST /upload_profile_picture_url   (server-side fetch by URL)
 *
 * Test Strategy:
 * 1. Register and log in a fresh user to obtain a token.
 * 2. Verify both endpoints require authentication.
 * 3. Verify the authenticated owner can upload a picture successfully.
 * 4. Probe the URL-import endpoint for Server Side Request Forgery by
 *    directing it at the app's own loopback-only metadata mock, which
 *    rejects direct external access but returns a known fixed-length body
 *    when reached — proving whether the fetch trusts attacker-supplied URLs
 *    into internal network space.
 */

const READ_SUCCESS_STATUSES = [200, 201];
const AUTH_DENIED_STATUSES = [401, 403];

test.describe('API - Profile picture management', () => {
  let session: AccountSession | null = null;

  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const api = await request.newContext({ baseURL: baseURL.toString() });
    session = await establishAccountSession(api, 'profile-api');
    await api.dispose();
  });

  test('POST /upload_profile_picture should require authentication', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const anon = await request.newContext({ baseURL: baseURL.toString() });
    const res = await uploadProfilePicture(anon, '');
    const status = res.status();
    await anon.dispose();

    expect(AUTH_DENIED_STATUSES).toContain(status);
    reporter.reportPass(
      'Profile picture upload rejected a request without a valid token.',
      'API2:2023 - Broken Authentication'
    );
  });

  test('POST /upload_profile_picture should let the authenticated owner upload a picture', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      test.skip(true, 'No account session available');
      return;
    }

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const res = await uploadProfilePicture(api, session.token);
    const status = res.status();
    const body = await res.json().catch(() => null);
    await api.dispose();

    testInfo.attach('upload-profile-picture', {
      body: JSON.stringify({ status, body }, null, 2),
      contentType: 'application/json'
    });

    expect(READ_SUCCESS_STATUSES).toContain(status);
    expect(body?.status).toBe('success');
    expect(typeof body?.file_path).toBe('string');

    reporter.reportPass(
      'Authenticated owner successfully uploaded a profile picture.',
      'API6:2023 - Unrestricted Access to Sensitive Business Flows'
    );
  });

  test('POST /upload_profile_picture_url should require authentication', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const anon = await request.newContext({ baseURL: baseURL.toString() });
    const res = await importProfilePictureFromUrl(anon, '', new URL('/static/user.png', baseURL).toString());
    const status = res.status();
    await anon.dispose();

    expect(AUTH_DENIED_STATUSES).toContain(status);
    reporter.reportPass(
      'Profile picture URL import rejected a request without a valid token.',
      'API2:2023 - Broken Authentication'
    );
  });

  test('POST /upload_profile_picture_url should not allow fetching internal-only resources (SSRF)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      test.skip(true, 'No account session available');
      return;
    }

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const probe = await attemptSsrfViaProfileUrlImport(api, session.token, baseURL.toString());
    await api.dispose();

    testInfo.attach('ssrf-probe', {
      body: JSON.stringify(probe, null, 2),
      contentType: 'application/json'
    });

    if (probe.succeeded) {
      reporter.reportVulnerability(
        'API7_MISCONFIGURATION',
        {
          endpoint: '/upload_profile_picture_url',
          matchedUrl: probe.matchedUrl,
          attempted: probe.attempted,
          response: probe.response
        },
        [
          'Resolve and validate the target host of image_url before fetching, rejecting loopback, link-local, and private address ranges.',
          'Use an allowlist of permitted external hosts/schemes for URL-based imports instead of an open fetch.',
          'Do not let the server-side fetch treat the app\'s own internal-only endpoints as trusted just because the request originates locally.'
        ]
      );
    } else {
      reporter.reportPass(
        'Profile picture URL import did not reach the loopback-only internal metadata endpoint through any attempted internal port.',
        'API7:2023 - Server Side Request Forgery'
      );
    }
  });
});
