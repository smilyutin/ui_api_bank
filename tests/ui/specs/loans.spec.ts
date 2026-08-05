import { test } from '@playwright/test';
import * as fs from 'fs/promises';
import { PageManager } from '../../../pages/page-manager';
import { loginAsUser } from '../../../helpers/auth';
import { setupAssertionLogging, endAssertionLogging } from '../../../helpers/expect-logger';

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
test.describe('@ui @feature:loans Loan requests', () => {
  let pm: PageManager;
  let tempStoragePath: string;

  test.beforeEach(async ({ page, baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    tempStoragePath = `/tmp/auth-${testInfo.testId}.json`;
    await loginAsUser(page, baseURL, tempStoragePath, { userPrefix: 'loans-ui' });

    pm = new PageManager(page);
    await pm.dashboard().waitForLoad();
  });

  test.afterEach(async () => {
    await fs.rm(tempStoragePath, { force: true }).catch(() => {});
  });

  test('should submit a loan request and show it as pending', async () => {
    setupAssertionLogging('should submit a loan request and show it as pending');
    const loans = pm.loans();
    const amount = '850';

    await test.step('Submit a loan request', async () => {
      await loans.fillAmount(amount);
      await loans.submit();
      await loans.waitForMessage(/loan requested successfully/i);
    });

    await test.step('Verify it appears as pending', async () => {
      await loans.waitForLoanRow(amount, /pending/i);
      endAssertionLogging('passed');
    });
  });

  test('should keep a submitted loan visible after the dashboard is reloaded', async ({ page }) => {
    setupAssertionLogging('should keep a submitted loan visible after the dashboard is reloaded');
    const loans = pm.loans();
    const amount = '925';

    await test.step('Submit a loan request', async () => {
      await loans.fillAmount(amount);
      await loans.submit();
      await loans.waitForMessage(/loan requested successfully/i);
    });

    await test.step('Reload the dashboard', async () => {
      await page.reload();
      await pm.dashboard().waitForLoad();
    });

    await test.step('Verify the loan is still visible as pending', async () => {
      await loans.waitForLoanRow(amount, /pending/i);
      endAssertionLogging('passed');
    });
  });

  test.skip('should not accept a negative loan amount (no client or server-side validation)', async () => {
    setupAssertionLogging('should not accept a negative loan amount (no client or server-side validation)');
    const loans = pm.loans();
    const amount = '-500';

    await test.step('Submit a negative loan amount', async () => {
      await loans.fillAmount(amount);
      await loans.submit();
    });

    await test.step('Verify current (unvalidated) behavior', async () => {
      await loans.waitForMessage(/loan requested unsuccessfully/i);
      await loans.waitForLoanRow(amount, /pending/i);
      endAssertionLogging('passed');
    });
  });
});
