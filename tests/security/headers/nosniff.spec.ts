import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { fetchHeaderAcrossEndpoints, buildRepresentativeEndpoints } from '../sec-objects/headers/security-headers.logic';

/**
 * Headers - X-Content-Type-Options (nosniff)
 *
 * No security response headers are set anywhere in app.py. Without
 * `X-Content-Type-Options: nosniff`, browsers may MIME-sniff a response's
 * content type rather than trusting the declared Content-Type — relevant
 * here specifically because tests/security/input/file-upload.spec.ts
 * confirms uploaded files are served back from /static/uploads/ with
 * whatever Content-Type Flask infers from the extension (a .html upload
 * comes back as text/html and executes). nosniff doesn't fix that on its
 * own, but its absence removes one layer of defense against content-type
 * confusion generally. Checked across a public HTML page, a public JSON
 * API, and the authenticated dashboard, not just /login.
 */
test.describe('@security  Headers - nosniff', () => {
  test('every representative endpoint should set X-Content-Type-Options: nosniff', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const results = await test.step('Fetch X-Content-Type-Options across representative endpoints', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      const session = await establishAccountSession(api, 'headers-nosniff');
      const endpoints = buildRepresentativeEndpoints(session?.token);
      const { results } = await fetchHeaderAcrossEndpoints(api, endpoints, 'x-content-type-options');
      await api.dispose();

      testInfo.attach('nosniff-probe', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
      return results;
    });

    await test.step('Verify nosniff is set on every endpoint', async () => {
      const missing = results.filter((r) => r.headerValue?.toLowerCase() !== 'nosniff');

      if (missing.length > 0) {
        reporter.reportVulnerability(
          'API7_MISCONFIGURATION',
          { missingEndpoints: missing.map((r) => `${r.path} (${r.label})`), allResults: results },
          ['Set X-Content-Type-Options: nosniff on every response (e.g. via an after_request hook) to stop browsers from MIME-sniffing served content.']
        );
      } else {
        reporter.reportPass(`X-Content-Type-Options: nosniff is present on all ${results.length} checked endpoints.`, 'API7:2023 - Server Side Request Forgery');
      }
    });
  });
});
