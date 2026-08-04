import { test, expect } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { setupAssertionLogging, endAssertionLogging } from '../../../helpers/expect-logger';

/**
 * Money Transfer Flow Tests
 *
 * These tests verify that the application provides a functional money transfer
 * feature that allows users to send money to other accounts successfully.
 *
 * Test Strategy:
 * 1. Authenticate with test user
 * 2. Navigate to money transfer page
 * 3. Fill transfer form with recipient and amount
 * 4. Submit transfer and verify success
 * 5. Confirm transfer completion
 *
 * Expected Behavior:
 * - Money transfer page should be accessible
 * - Form should accept valid recipient and amount
 * - Transfer should be processed successfully
 * - Success confirmation should be displayed
 * - Transfer should be recorded
 */

/**
 * Test: Send money successfully
 *
 * Purpose: Verifies that the money transfer functionality works correctly
 * and allows users to send money to other accounts.
 *
 * Test Strategy:
 * 1. Authenticate with test user
 * 2. Navigate to money transfer from dashboard
 * 3. Fill recipient account number and amount
 * 4. Add transfer description
 * 5. Submit transfer
 * 6. Verify success confirmation
 */
test.describe('@ui @feature:money-transfer Money transfer flow', () => {
  test('should send money successfully', async ({ page, baseURL, request }) => {
    setupAssertionLogging('should send money successfully');
    if (!baseURL) throw new Error('baseURL is not defined');

    const recipient = await test.step('Authenticate and establish a recipient account', async () => {
      await ensureDashboardAuthenticated(page, {
        baseURL: baseURL.toString(),
        role: 'user',
        fallbackUserPrefix: 'e2e',
      });

      // A real, freshly created recipient account instead of a hardcoded
      // number that /transfer just happens not to validate today.
      const recipient = await establishAccountSession(request, 'transfer-ui-recipient');
      if (!recipient) throw new Error('Could not establish a recipient account for the transfer');
      return recipient;
    });

    const pm = new PageManager(page);
    const dash = pm.dashboard();

    await test.step('Navigate to the money transfer page', async () => {
      await dash.waitForLoad();

      // Use text-based navigation link for reliability across all viewports.
      const transferLink = page.getByRole('link', { name: /send money|transfer|transfers/i });
      if (await transferLink.count()) {
        await dash.clickNavigationLinkByText(/send money|transfer|transfers/i);
      } else {
        // Fallback: click a tile/button that contains 'Send Money'
        const tile = page.getByText(/send money|transfer money/i);
        if (await tile.count()) await tile.first().click();
      }
    });

    const mt = pm.moneyTransfer();
    const amount = '5.00';

    await test.step('Fill and submit the transfer form', async () => {
      await mt.fillRecipient(recipient.accountNumber);
      await mt.fillAmount(amount);
      await mt.fillDescription('UI test transfer');
      await mt.submit();
    });

    await test.step('Verify transfer success', async () => {
      await mt.waitForSuccess();
      endAssertionLogging('passed');
    });
  });
});
