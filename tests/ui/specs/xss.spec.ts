import { test, expect } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';
import { SecurityReporter } from '../../../fixtures/helper/security-reporter';
import { TRANSFER_DESCRIPTION_XSS_PAYLOAD, XSS_MARKER } from '../../../fixtures/api/xss.helpers';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { loggedExpect, setupAssertionLogging, endAssertionLogging } from '../../../helpers/expect-logger';

/**
 * UI - Stored XSS via transfer description
 *
 * static/dashboard.js's fetchTransactions() builds the transaction list with
 * `transaction-list.innerHTML = transactionHtml`, interpolating each
 * transaction's `description` directly into the HTML string with no
 * escaping (the vulnerability is even labeled in a comment there:
 * "// Vulnerability: innerHTML used with unsanitized data"). POST /transfer
 * stores `description` from the request body as-is (app.py).
 *
 * This can only be proven with a real browser — an API-only check would
 * confirm the raw string round-trips through storage, but not that it
 * actually executes once rendered. The payload sets a marker on `window`
 * from an `<img onerror>` handler; the marker firing is the proof.
 *
 * There's no equivalent API-level SecurityReporter finding for this vector
 * (unlike other UI specs that mirror an API-level check) — the DOM sink is
 * only reachable through a real browser, so this test reports it directly.
 */
test.describe('UI - Stored XSS via transfer description', () => {
  test('a script-bearing transfer description should not execute when the transaction list renders', async ({ page, baseURL, request }, testInfo) => {
    setupAssertionLogging('a script-bearing transfer description should not execute when the transaction list renders');
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    await ensureDashboardAuthenticated(page, {
      baseURL: baseURL.toString(),
      role: 'user',
      fallbackUserPrefix: 'xss-ui',
    });

    // A real, freshly created recipient account instead of a hardcoded
    // number that /transfer just happens not to validate today.
    const recipient = await establishAccountSession(request, 'xss-ui-recipient');
    if (!recipient) throw new Error('Could not establish a recipient account for the transfer');

    const pm = new PageManager(page);
    const dash = pm.dashboard();
    await dash.waitForLoad();

    const transferLink = page.getByRole('link', { name: /send money|transfer|transfers/i });
    if (await transferLink.count()) {
      await dash.clickNavigationLinkByText(/send money|transfer|transfers/i);
    } else {
      const tile = page.getByText(/send money|transfer money/i);
      if (await tile.count()) await tile.first().click();
    }

    const mt = pm.moneyTransfer();
    const amount = '1.00';
    await mt.fillRecipient(recipient.accountNumber);
    await mt.fillAmount(amount);
    await mt.fillDescription(TRANSFER_DESCRIPTION_XSS_PAYLOAD);
    await mt.submit();

    await mt.waitForSuccess();

    let fired = false;
    try {
      await expect.poll(
        async () => (await page.evaluate<boolean>((marker) => (window as any)[marker] === true, XSS_MARKER)),
        { timeout: 3000 }
      ).toBeTruthy();
      fired = true;
    } catch {
      fired = false;
    }

    testInfo.attach('xss-transfer-description-probe', {
      body: JSON.stringify({ payload: TRANSFER_DESCRIPTION_XSS_PAYLOAD, marker: XSS_MARKER, fired }, null, 2),
      contentType: 'application/json'
    });

    if (fired) {
      reporter.reportVulnerability(
        'API8_SECURITY_MISCONFIGURATION',
        {
          endpoint: 'POST /transfer (rendered via the dashboard transaction list)',
          vector: 'description',
          payload: TRANSFER_DESCRIPTION_XSS_PAYLOAD,
          issue: 'A transfer description executes as HTML/JS when the transaction list re-renders, because static/dashboard.js assigns it into transaction-list.innerHTML with no escaping.'
        },
        [
          'Use textContent (or an explicit escaping helper) instead of innerHTML when rendering transaction.description in static/dashboard.js.',
          'Sanitize/escape user-supplied description text server-side before persisting it, in addition to fixing the client-side rendering.',
          'Add a Content-Security-Policy header to reduce the blast radius of any HTML that does get injected.'
        ]
      );
    } else {
      reporter.reportPass(
        'A script-bearing transfer description did not execute when the transaction list rendered.',
        'API8:2023 - Security Misconfiguration'
      );
    }
    endAssertionLogging('passed');
  });
});
