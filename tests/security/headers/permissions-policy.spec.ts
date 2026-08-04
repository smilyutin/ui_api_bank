import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { fetchHeaderAcrossEndpoints, buildRepresentativeEndpoints } from '../sec-objects/headers/security-headers.logic';

/**
 * Headers - Permissions-Policy
 *
 * No security response headers are set anywhere in app.py, including
 * Permissions-Policy — so there's no restriction on which browser
 * features (camera, microphone, geolocation, etc.) any page on this
 * origin, or an embedded frame of it, is allowed to request. Checked
 * across a public HTML page, a public JSON API, and the authenticated
 * dashboard, not just /login.
 */
test.describe('Headers - Permissions-Policy', () => {
  test('every representative endpoint should set a Permissions-Policy', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const results = await test.step('Fetch the Permissions-Policy header across representative endpoints', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      const session = await establishAccountSession(api, 'headers-permissions-policy');
      const endpoints = buildRepresentativeEndpoints(session?.token);
      const { results } = await fetchHeaderAcrossEndpoints(api, endpoints, 'permissions-policy');
      await api.dispose();

      testInfo.attach('permissions-policy-probe', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
      return results;
    });

    await test.step('Verify it is set on every endpoint', async () => {
    const missing = results.filter((r) => !r.headerValue);

    if (missing.length > 0) {
      reporter.reportVulnerability(
        'API7_MISCONFIGURATION',
        { missingEndpoints: missing.map((r) => `${r.path} (${r.label})`), allResults: results },
        ['Set a Permissions-Policy header restricting unused browser features (camera=(), microphone=(), geolocation=(), etc.) — this app has no legitimate use for any of them.']
      );
      } else {
        reporter.reportPass(`Permissions-Policy present on all ${results.length} checked endpoints.`, 'API7:2023 - Server Side Request Forgery');
      }
    });
  });
});
