import { test } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';

/**
 * Loan Request Tests (UI)
 *
 * These tests verify that the dashboard's loan request form lets an
 * authenticated user submit a loan application and see it reflected as
 * pending, both immediately and after a fresh page load.
 *
 * Test Strategy:
 * 1. Authenticate and load the dashboard.
 * 2. Submit a loan request through the LoansPage POM.
 * 3. Verify the confirmation message and the new row in "Your Loan
 *    Applications".
 * 4. Reload to confirm the loan was actually persisted server-side, not just
 *    appended to the DOM optimistically.
 *
 * The negative-amount case documents actual current behavior rather than
 * asserting a "should reject" expectation: the `#loan_amount` input has no
 * `min` attribute (templates/dashboard.html) and `/request_loan` performs no
 * server-side validation on `amount` (app.py, explicitly commented as a
 * known vulnerability), so a negative amount is accepted end-to-end. The
 * equivalent API-level finding is reported via SecurityReporter in
 * tests/api/loans.spec.ts; this UI test just confirms the same behavior is
 * visible through the dashboard.
 */
test.describe('Loan requests', () => {
  let pm: PageManager;

  test.beforeEach(async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    await ensureDashboardAuthenticated(page, {
      baseURL: baseURL.toString(),
      role: 'user',
      fallbackUserPrefix: 'loans-ui',
    });

    pm = new PageManager(page);
    await pm.dashboard().waitForLoad();
  });

  test('should submit a loan request and show it as pending', async () => {
    const loans = pm.loans();
    const amount = '850';

    await loans.fillAmount(amount);
    await loans.submit();

    await loans.waitForMessage(/loan requested successfully/i);
    await loans.waitForLoanRow(amount, /pending/i);
  });

  test('should keep a submitted loan visible after the dashboard is reloaded', async ({ page }) => {
    const loans = pm.loans();
    const amount = '925';

    await loans.fillAmount(amount);
    await loans.submit();
    await loans.waitForMessage(/loan requested successfully/i);

    await page.reload();
    await pm.dashboard().waitForLoad();

    await loans.waitForLoanRow(amount, /pending/i);
  });

  test('should accept a negative loan amount (no client or server-side validation)', async () => {
    const loans = pm.loans();
    const amount = '-500';

    await loans.fillAmount(amount);
    await loans.submit();

    await loans.waitForMessage(/loan requested successfully/i);
    await loans.waitForLoanRow(amount, /pending/i);
  });
});
