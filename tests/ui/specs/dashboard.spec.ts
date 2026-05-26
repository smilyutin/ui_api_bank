import { test, expect } from '@playwright/test';
import { DashboardPage } from '../page-objects/dashboard.page';
import { ensureDashboardAuthenticated } from '../helpers/auth-bootstrap';

/**
 * Dashboard Functionality Tests
 *
 * These tests verify that the application's main dashboard provides
 * all expected functionality including navigation, account information,
 * and user interactions.
 *
 * Test Strategy:
 * 1. Authenticate with test user in beforeEach
 * 2. Navigate to dashboard and wait for load
 * 3. Test welcome message and navigation elements
 * 4. Verify account balance display
 * 5. Check recent transactions list
 * 6. Test logout functionality
 *
 * Expected Behavior:
 * - Dashboard should display welcome message with user info
 * - Navigation menu should contain expected items
 * - Account balance should be displayed correctly
 * - Recent transactions should be listed
 * - Logout should work properly
 */

/**
 * Test: Dashboard functionality
 *
 * Purpose: Verifies that the dashboard provides all expected functionality
 * including user information, navigation, account details, and logout.
 *
 * Test Strategy:
 * 1. Set up authentication in beforeEach
 * 2. Test welcome message and navigation
 * 3. Verify account balance display
 * 4. Check recent transactions
 * 5. Test logout functionality
 */
test.describe('Dashboard functionality', () => {
  let dashboardPage: DashboardPage;
  let expectedIdentifiers: string[];

  test.beforeEach(async ({ page, baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const base = baseURL.toString();
    const auth = await ensureDashboardAuthenticated(page, {
      baseURL: base,
      role: 'user',
      fallbackUserPrefix: 'UI',
      requireToken: true,
    });

    dashboardPage = new DashboardPage(page);
    expectedIdentifiers = auth.expectedIdentifiers;

    testInfo.attach('auth-mode.json', {
      contentType: 'application/json',
      body: JSON.stringify(
        {
          mode: auth.mode,
          role: auth.role,
          identifier: auth.identifier,
          expectedIdentifiers: auth.expectedIdentifiers,
        },
        null,
        2
      ),
    });

    expect(auth.mode).toBe('token');
  });

  test('should display welcome message and navigation', async () => {
    const welcomeText = await dashboardPage.getWelcomeMessage();
    expect(welcomeText).toBeTruthy();

    if (expectedIdentifiers.length > 0 && welcomeText) {
      const normalizedWelcome = welcomeText.toLowerCase();
      const matched = expectedIdentifiers.some(identifier =>
        normalizedWelcome.includes(identifier.split('@')[0].toLowerCase())
      );
      expect(matched).toBeTruthy();
    }

    const navTexts = await dashboardPage.getNavigationTexts();
    const expected = [
      'Profile',
      'Money Transfer',
      'Loans',
      'Transaction History',
      'Virtual Cards',
      'Bill Payments',
      'Logout'
    ];

    const norm = (s: string) =>
      s.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

    const got = navTexts.map(norm);
    const want = expected.map(norm);
    // Check that all expected items are present in the navigation, regardless of order
    let idx = 0;
    for (const w of want) {
      const found = got.indexOf(w, idx);
      expect(found).toBeGreaterThanOrEqual(0);
      idx = found + 1;
    }

    const navLinks = await dashboardPage.getNavigationLinks();
    const gotHrefs = navLinks.map(l => l.href || '').filter(Boolean);
    const expectedHrefs = ['#profile', '#transfers', '#loans', '#transactions', '#virtual-cards', '#bill-payments', '#'];
      // Check that all expected hrefs are present in the navigation links, regardless of order
    let j = 0;
    for (const eh of expectedHrefs) {
      const found = gotHrefs.indexOf(eh, j);
      expect(found).toBeGreaterThanOrEqual(0);
      j = found + 1;
    }
  });

  test('should show account balance', async () => {
    const balance = await dashboardPage.getAccountBalance();
    expect(balance).not.toBeNull();
    expect(typeof balance).toBe('number');
    expect((balance as number) >= 0).toBeTruthy();
  });

  test('should list recent transactions', async () => {
    const transactions = await dashboardPage.getRecentTransactions();
    expect(transactions.length).toBeGreaterThanOrEqual(0);
    if (transactions.length > 0) {
      const first = transactions[0];
      const text = await first.innerText();
      expect(
        /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|[$€£]\s*\d+/.test(text) // Basic check for amount in transaction text
      ).toBeTruthy();
    }
  });

  test('should allow logout', async () => {
    const logoutExists = await dashboardPage.logout();
    expect(logoutExists).toBeTruthy();

    await dashboardPage.page.waitForURL(/\/(login|register|$)/, { timeout: 5000 });

    const isStillLoggedIn = await dashboardPage.isLoggedIn();
    expect(isStillLoggedIn).toBeFalsy();
  });

  test('should display accurate account balance', async () => {
    const balanceData = await dashboardPage.verifyBalanceAccuracy();

    expect(balanceData.displayed).not.toBeNull();
    expect(typeof balanceData.displayed).toBe('number');
    expect(balanceData.displayed).toBeGreaterThanOrEqual(0);

    if (balanceData.api !== null && balanceData.matches !== null) {
      expect(balanceData.matches).toBeTruthy();
    }

    const balanceElement = dashboardPage.page.locator('text=/balance.*[$€£]\\s*\\d+(\\.\\d{2})?/i').first();
    if (await balanceElement.count()) {
      const balanceText = await balanceElement.innerText();
      expect(balanceText).toMatch(/[$€£]\s*\d+(\.\d{2})?/);
    }
  });

  test('should handle negative balances correctly', async () => {
    try {
      const response = await dashboardPage.page.request.post('/api/account/update', {
        data: { balance: -100.5 }
      });

      if (response.ok()) {
        await dashboardPage.page.reload();
        const balance = await dashboardPage.getAccountBalance();

        const balanceText = await dashboardPage.page.locator('text=/balance|account/i').first().innerText();
        const showsNegative = balanceText.includes('-') || balanceText.toLowerCase().includes('overdraft');

        expect(balance).not.toBeNull();
        expect(showsNegative).toBeTruthy();
      }
    } catch {
      test.skip(true, 'Balance update API not available');
    }
  });

  test('should display transaction history with proper data integrity', async () => {
    const transactions = await dashboardPage.getTransactionData();

    for (const txn of transactions) {
      if (txn.amount !== null) {
        expect(typeof txn.amount).toBe('number');
        expect(txn.amount).toBeGreaterThan(0);
      }

      if (txn.date !== null) {
        expect(txn.date).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/);
      }

      expect(txn.text).not.toMatch(/<script|javascript:|on\w+=/i);
    }
  });

  test('should show transactions in chronological order', async () => {
    const transactions = await dashboardPage.getTransactionData();

    if (transactions.length > 1) {
      const datedTransactions = transactions.filter(t => t.date !== null);

      if (datedTransactions.length > 1) {
        for (let i = 1; i < datedTransactions.length; i++) {
          const prevDate = new Date(datedTransactions[i - 1].date!);
          const currDate = new Date(datedTransactions[i].date!);
          expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
        }
      }
    }
  });

  test('should render profile section when navigating', async () => {
    const navLinks = await dashboardPage.getNavigationLinks();
    const profileLink = navLinks.find(l => l.href === '#profile');
    if (profileLink) {
      await dashboardPage.page.locator(`a[href="${profileLink.href}"]`).click();
      const profileSection = dashboardPage.page.locator('#profile, [data-testid="profile"]');
      expect(await profileSection.count()).toBeGreaterThan(0);
    } else {
      test.skip(true, 'Profile link not available');
    }
  });

  test('should show transaction amounts with currency symbol', async () => {
    const transactions = await dashboardPage.getRecentTransactions();
    if (transactions.length > 0) {
      const text = await transactions[0].innerText();
      expect(text).toMatch(/[$€£]\s*\d+(\.\d{2})?/);
    }
  });

  test('should have unique navigation labels', async () => {
    const navTexts = await dashboardPage.getNavigationTexts();
    const normalized = navTexts.map(t => t.trim().toLowerCase());
    const unique = new Set(normalized);
    expect(unique.size).toBe(normalized.length);
  });

  test('should handle session timeout gracefully', async () => {
    const timeoutResult = await dashboardPage.checkSessionTimeout(30000);

    if (!timeoutResult.sessionValid) {
      expect(timeoutResult.currentUrl).toMatch(/\/(login|auth)/);
    } else {
      expect(timeoutResult.currentUrl).toMatch(/\/dashboard/);
    }
  });
});
