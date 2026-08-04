import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { fetchHeaderAcrossEndpoints, buildRepresentativeEndpoints } from '../sec-objects/headers/security-headers.logic';

/**
 * Headers - HSTS (Strict-Transport-Security)
 *
 * No security response headers are set anywhere in app.py. Without HSTS, a
 * user who reaches the app over plain HTTP even once (e.g. a stale
 * bookmark, a typed URL without https://) has no browser-enforced upgrade
 * to HTTPS on subsequent visits, leaving every request open to downgrade/
 * MITM interception. This is reported informationally: HSTS is only
 * meaningful once the deployment actually serves HTTPS, which this local
 * target does not — the header being present or absent doesn't change
 * behavior over plain HTTP, but its absence still means it will not
 * protect the app once HTTPS *is* in front of it (e.g. behind a reverse
 * proxy), which is the real-world deployment shape this matters for.
 * Checked across a public HTML page, a public JSON API, and the
 * authenticated dashboard, not just /login.
 */
test.describe('@security  Headers - HSTS', () => {
  test('every representative endpoint should set Strict-Transport-Security', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const results = await test.step('Fetch the Strict-Transport-Security header across representative endpoints', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      const session = await establishAccountSession(api, 'headers-hsts');
      const endpoints = buildRepresentativeEndpoints(session?.token);
      const { results } = await fetchHeaderAcrossEndpoints(api, endpoints, 'strict-transport-security');
      await api.dispose();

      testInfo.attach('hsts-probe', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
      return results;
    });

    await test.step('Verify it is set on every endpoint', async () => {
      const missing = results.filter((r) => !r.headerValue);

      if (missing.length > 0) {
        reporter.reportVulnerability(
          'API7_MISCONFIGURATION',
          { missingEndpoints: missing.map((r) => `${r.path} (${r.label})`), allResults: results },
          [
            'Set Strict-Transport-Security (e.g. max-age=31536000; includeSubDomains) once the app is served over HTTPS, so browsers enforce HTTPS on every subsequent visit.',
            'If deployed behind a reverse proxy/load balancer that terminates TLS, add the header there rather than in the Flask app if that\'s more consistent with the deployment.'
          ]
        );
      } else {
        reporter.reportPass(`Strict-Transport-Security present on all ${results.length} checked endpoints.`, 'API7:2023 - Server Side Request Forgery');
      }
    });
  });
});
