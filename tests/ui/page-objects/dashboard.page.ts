import { Page, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(baseURL: string) {
    await this.page.goto(new URL('/dashboard', baseURL).toString());
  }

  async isLoggedIn() {
      // Check URL is dashboard and elements exist
      const url = this.page.url();
      const onDashboard = url.toLowerCase().includes('/dashboard');
      if (!onDashboard) return false;

      // Look for typical dashboard elements
      const hasElements = await this.page.getByRole('heading', { name: /dashboard|welcome/i }).count() > 0 ||
        await this.page.getByRole('navigation').count() > 0 ||
        await this.page.getByRole('main').count() > 0;

      return hasElements;
  }

  async getWelcomeMessage() {
    const heading = this.page.getByRole('heading', { name: /dashboard|welcome/i });
    if (await heading.count()) return heading.innerText();
    return null;
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    // Wait for typical dashboard elements to be ready
    await expect(async () => {
      const isReady = await this.isLoggedIn();
      expect(isReady).toBeTruthy();
    }).toPass({ timeout: 5000 });
  }

  async getNavigationItems() {
    const nav = this.page.getByRole('navigation');
    if (await nav.count()) {
      return nav.getByRole('link').all();
    }
    return [];
  }

  // Return visible navigation item texts in order
  async getNavigationTexts(): Promise<string[]> {
    const nav = this.page.getByRole('navigation');
    if (!(await nav.count())) return [];
    const links = nav.locator('a, button, [role="link"]');
    const count = await links.count();
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const el = links.nth(i);
      const text = (await el.innerText()).trim();
      if (text) out.push(text);
    }
    return out;
  }

  // Return visible navigation items with hrefs (text, href) in order
  async getNavigationLinks(): Promise<Array<{ text: string; href: string }>> {
    const nav = this.page.getByRole('navigation');
    if (!(await nav.count())) return [];
    const anchors = nav.locator('a');
    const out: Array<{ text: string; href: string }> = [];
    const count = await anchors.count();
    for (let i = 0; i < count; i++) {
      const a = anchors.nth(i);
      const text = (await a.innerText()).trim();
      const href = (await a.getAttribute('href')) || '';
      out.push({ text, href });
    }
    return out;
  }

  async getAccountBalance() {
    // Try several selectors that might contain balance, ordered by specificity
    const balanceSelectors = [
      '[data-testid*="balance"]',
      '[data-testid*="account-balance"]',
      '.account-balance',
      '.main-balance',
      '#balance',
      '#account-balance',
      '.balance:first-of-type',
      'text=/balance:\\s*[$€£]\\d+(\\.\\d{2})?/i'
    ];
    for (const selector of balanceSelectors) {
      const el = this.page.locator(selector);
      if (await el.count()) {
        // Handle multiple matches by taking the first one
        const text = await el.first().innerText();
        // Extract number from text
        const match = text.match(/[$€£]?\s*(\d+(\.\d{2})?)/);
        return match ? parseFloat(match[1]) : null;
      }
    }
    return null;
  }

  async getRecentTransactions() {
    // Look for a transactions list/table
    const txnSelectors = [
      '[data-testid*="transactions"]',
      'table:has-text("transactions")',
      '.transactions',
      '#transactions',
      '.transaction-list',
      '.transaction-history'
    ];
    for (const selector of txnSelectors) {
      const el = this.page.locator(selector);
      if (await el.count()) {
        // If it's a table, get rows
        const rows = el.locator('tr');
        if (await rows.count()) {
          return rows.all();
        }
        // If it's a list, get items
        const items = el.locator('li, .transaction-item');
        if (await items.count()) {
          return items.all();
        }
      }
    }
    return [];
  }

  async getTransactionData() {
    const transactions = await this.getRecentTransactions();
    const txnData = [];

    for (const txn of transactions) {
      const text = await txn.innerText();
      // Extract transaction details
      const amountMatch = text.match(/[$€£]?\s*(\d+(\.\d{2})?)/);
      const dateMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/);

      txnData.push({
        text,
        amount: amountMatch ? parseFloat(amountMatch[1]) : null,
        date: dateMatch ? dateMatch[0] : null,
        element: txn
      });
    }

    return txnData;
  }

  async verifyBalanceAccuracy() {
    // Get displayed balance
    const displayedBalance = await this.getAccountBalance();

    // Try to verify against API if available
    try {
      const apiResponse = await this.page.request.get('/api/account/balance');
      if (apiResponse.ok()) {
        const apiData = await apiResponse.json();
        const apiBalance = apiData.balance || apiData.amount || apiData.value;

        return {
          displayed: displayedBalance,
          api: apiBalance,
          matches: Math.abs((displayedBalance || 0) - (apiBalance || 0)) < 0.01
        };
      }
    } catch (e) {
      // API might not be available
    }

    return {
      displayed: displayedBalance,
      api: null,
      matches: null
    };
  }

  async checkSessionTimeout(timeoutMs: number = 30000) {
    const startTime = Date.now();
    const initialUrl = this.page.url();

    // Leave headroom so the test itself doesn't hit the global timeout
    const safeWaitMs = Math.max(0, timeoutMs - 2000);
    if (safeWaitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, safeWaitMs));
    }

    if (this.page.isClosed()) {
      return {
        timeElapsed: Date.now() - startTime,
        sessionValid: false,
        currentUrl: initialUrl,
        error: new Error('Page was closed before the session timeout check completed')
      };
    }

    // Check if session is still valid
    try {
      await this.page.reload();
      const isStillLoggedIn = await this.isLoggedIn();

      return {
        timeElapsed: Date.now() - startTime,
        sessionValid: isStillLoggedIn,
        currentUrl: this.page.url()
      };
    } catch (e) {
      return {
        timeElapsed: Date.now() - startTime,
        sessionValid: false,
        currentUrl: initialUrl,
        error: e
      };
    }
  }

  async logout() {
      // Try role=button with logout text
      const logoutBtn = this.page.getByRole('button', { name: /log ?out|sign ?out/i });
      if (await logoutBtn.count()) {
        await logoutBtn.click();
        return true;
      }

      // Try link with logout text
      const logoutLink = this.page.getByRole('link', { name: /log ?out|sign ?out/i });
      if (await logoutLink.count()) {
        await logoutLink.click();
        return true;
      }

      // Try text matching
      const logoutText = this.page.getByText(/log ?out|sign ?out/i);
      if (await logoutText.count()) {
        await logoutText.click();
        return true;
      }

      // Try other common selectors
      const otherSelectors = [
        '[data-testid*="logout"]',
        '.logout',
        '#logout',
        'button[type="button"]'
      ];
      for (const selector of otherSelectors) {
        const el = this.page.locator(selector);
        if (await el.count()) {
          await el.click();
          return true;
        }
      }

      return false;
  }
}
