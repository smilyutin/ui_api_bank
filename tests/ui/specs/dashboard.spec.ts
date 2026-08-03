import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../../pages/dashboard.page';
import { PageManager } from '../../../pages/page-manager';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';
import { loggedExpect, setupAssertionLogging, endAssertionLogging } from '../../../helpers/expect-logger';

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

    dashboardPage = new PageManager(page).dashboard();
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

    loggedExpect(auth.mode, 'auth.mode').toBe('token');
  });

  test('should display welcome message and navigation', async () => {
    setupAssertionLogging('should display welcome message and navigation');
    const welcomeText = await dashboardPage.getWelcomeMessage();
    loggedExpect(welcomeText, 'welcomeText').toBeTruthy();

    if (expectedIdentifiers.length > 0 && welcomeText) {
      const normalizedWelcome = welcomeText.toLowerCase();
      const matched = expectedIdentifiers.some(identifier =>
        normalizedWelcome.includes(identifier.split('@')[0].toLowerCase())
      );
      loggedExpect(matched, 'matched').toBeTruthy();
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
      loggedExpect(found, `found ${w}`).toBeGreaterThanOrEqual(0);
      idx = found + 1;
    }

    const navLinks = await dashboardPage.getNavigationLinks();
    const gotHrefs = navLinks.map(l => l.href || '').filter(Boolean);
    const expectedHrefs = ['#profile', '#transfers', '#loans', '#transactions', '#virtual-cards', '#bill-payments', '#'];
      // Check that all expected hrefs are present in the navigation links, regardless of order
    let j = 0;
    for (const eh of expectedHrefs) {
      const found = gotHrefs.indexOf(eh, j);
      loggedExpect(found, `found href ${eh}`).toBeGreaterThanOrEqual(0);
      j = found + 1;
    }
    endAssertionLogging('passed');
  });

  test('should show account balance', async () => {
    setupAssertionLogging('should show account balance');
    const balance = await dashboardPage.getAccountBalance();
    loggedExpect(balance, 'balance').not.toBeNull();
    loggedExpect(typeof balance, 'typeof balance').toBe('number');
    loggedExpect((balance as number) >= 0, 'balance >= 0').toBeTruthy();
    endAssertionLogging('passed');
  });

  test('should list recent transactions', async () => {
    setupAssertionLogging('should list recent transactions');
    const transactions = await dashboardPage.getRecentTransactions();
    if (transactions.length === 0) {
      loggedExpect(await dashboardPage.hasEmptyTransactionsMessage(), 'hasEmptyTransactionsMessage').toBeTruthy();
      endAssertionLogging('passed');
      return;
    }

    const text = await transactions[0].innerText();
    loggedExpect(
      /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|[$€£]\s*\d+/.test(text), // Basic check for amount in transaction text
      'transaction text matches pattern'
    ).toBeTruthy();
    endAssertionLogging('passed');
  });

  test('should allow logout', async () => {
    setupAssertionLogging('should allow logout');
    const logoutExists = await dashboardPage.logout();
    loggedExpect(logoutExists, 'logoutExists').toBeTruthy();

    await expect(dashboardPage.page).toHaveURL(/\/(login|register|$)/, { timeout: 5000 });

    const isStillLoggedIn = await dashboardPage.isLoggedIn();
    loggedExpect(isStillLoggedIn, 'isStillLoggedIn').toBeFalsy();
    endAssertionLogging('passed');
  });

  test('should display accurate account balance', async () => {
    setupAssertionLogging('should display accurate account balance');
    const balanceData = await dashboardPage.verifyBalanceAccuracy();

    loggedExpect(balanceData.displayed, 'balanceData.displayed').not.toBeNull();
    loggedExpect(typeof balanceData.displayed, 'typeof balanceData.displayed').toBe('number');
    loggedExpect(balanceData.displayed, 'balanceData.displayed').toBeGreaterThanOrEqual(0);

    loggedExpect(balanceData.api, 'balanceData.api').not.toBeNull();
    loggedExpect(balanceData.matches, 'balanceData.matches').toBeTruthy();
    endAssertionLogging('passed');
  });

  test('should display transaction history with proper data integrity', async () => {
    setupAssertionLogging('should display transaction history with proper data integrity');
    const transactions = await dashboardPage.getTransactionData();

    for (const txn of transactions) {
      if (txn.amount !== null) {
        loggedExpect(typeof txn.amount, 'typeof txn.amount').toBe('number');
        loggedExpect(txn.amount, 'txn.amount').toBeGreaterThan(0);
      }

      if (txn.date !== null) {
        loggedExpect(txn.date, 'txn.date').toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/);
      }

      loggedExpect(txn.text, 'txn.text').not.toMatch(/<script|javascript:|on\w+=/i);
    }
    endAssertionLogging('passed');
  });

  test('should show transactions in chronological order', async () => {
    setupAssertionLogging('should show transactions in chronological order');
    const transactions = await dashboardPage.getTransactionData();

    if (transactions.length > 1) {
      const datedTransactions = transactions.filter(t => t.date !== null);

      if (datedTransactions.length > 1) {
        for (let i = 1; i < datedTransactions.length; i++) {
          const prevDate = new Date(datedTransactions[i - 1].date!);
          const currDate = new Date(datedTransactions[i].date!);
          loggedExpect(prevDate.getTime(), `prevDate[${i}] >= currDate[${i}]`).toBeGreaterThanOrEqual(currDate.getTime());
        }
      }
    }
    endAssertionLogging('passed');
  });

  test('should render profile section when navigating', async () => {
    setupAssertionLogging('should render profile section when navigating');
    const navLinks = await dashboardPage.getNavigationLinks();
    const profileLink = navLinks.find(l => l.href === '#profile');
    loggedExpect(profileLink, 'profileLink').toBeTruthy();

    // Dashboard sections are static, single-page anchors (see static/dashboard.js
    // handleScroll) — "navigating" means the click scrolls #profile into view,
    // not that it gets inserted/toggled in the DOM.
    await dashboardPage.clickNavigationLink(`a[href="${profileLink!.href}"]`);
    const profileSection = dashboardPage.page.locator('#profile');
    await expect(profileSection).toBeInViewport();
    endAssertionLogging('passed');
  });

  test('should show transaction amounts with currency symbol', async () => {
    setupAssertionLogging('should show transaction amounts with currency symbol');
    const transactions = await dashboardPage.getRecentTransactions();
    if (transactions.length === 0) {
      loggedExpect(await dashboardPage.hasEmptyTransactionsMessage(), 'hasEmptyTransactionsMessage').toBeTruthy();
      endAssertionLogging('passed');
      return;
    }

    const text = await transactions[0].innerText();
    loggedExpect(text, 'transaction text').toMatch(/[$€£]\s*\d+(\.\d{2})?/);
    endAssertionLogging('passed');
  });

  test('should have unique navigation labels', async () => {
    setupAssertionLogging('should have unique navigation labels');
    const navTexts = await dashboardPage.getNavigationTexts();
    const normalized = navTexts.map(t => t.trim().toLowerCase());
    const unique = new Set(normalized);
    loggedExpect(unique.size, 'unique.size').toBe(normalized.length);
    endAssertionLogging('passed');
  });
});
