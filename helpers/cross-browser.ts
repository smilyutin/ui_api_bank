import { Page, BrowserContext, expect } from '@playwright/test';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type BrowserType = 'desktop' | 'mobile';

interface BrowserCapabilities {
  supportsLocalStorage: boolean;
  supportsSessionStorage: boolean;
  supportsCookies: boolean;
  requiresExplicitWaits: boolean;
  hasWebkitBugs: boolean;
  focusOutlineWidth: number;
}

export class CrossBrowserHelper {
  constructor(private page: Page, private browserName: BrowserName) {}

  /**
   * Get browser capabilities and quirks for the current browser.
   * Use this to conditionally apply workarounds in tests.
   */
  getCapabilities(): BrowserCapabilities {
    switch (this.browserName) {
      case 'chromium':
        return {
          supportsLocalStorage: true,
          supportsSessionStorage: true,
          supportsCookies: true,
          requiresExplicitWaits: false,
          hasWebkitBugs: false,
          focusOutlineWidth: 2,
        };
      case 'firefox':
        return {
          supportsLocalStorage: true,
          supportsSessionStorage: true,
          supportsCookies: true,
          requiresExplicitWaits: true, // Firefox sometimes needs extra waits
          hasWebkitBugs: false,
          focusOutlineWidth: 2,
        };
      case 'webkit':
        return {
          supportsLocalStorage: true,
          supportsSessionStorage: false, // Safari has limited sessionStorage
          supportsCookies: true,
          requiresExplicitWaits: true, // Safari needs explicit waits for focus
          hasWebkitBugs: true,
          focusOutlineWidth: 1,
        };
    }
  }

  /**
   * Conditionally skip test on specific browser.
   * Usage: if (cbh.shouldSkipOn('webkit')) { test.skip(); }
   */
  shouldSkipOn(browsers: BrowserName | BrowserName[]): boolean {
    const browserList = Array.isArray(browsers) ? browsers : [browsers];
    return browserList.includes(this.browserName);
  }

  /**
   * Get browser name for conditional logic.
   */
  isBrowser(name: BrowserName): boolean {
    return this.browserName === name;
  }

  /**
   * Apply browser-specific authentication storage strategy.
   * Firefox/WebKit: Use cookies preferentially
   * Chromium: Can use localStorage or sessionStorage
   */
  async setupAuthStorage(token: string, storageMethod: 'localStorage' | 'sessionStorage' | 'cookie' = 'auto') {
    if (storageMethod === 'auto') {
      // Auto-select based on browser
      if (this.browserName === 'webkit') {
        await this.setAuthCookie(token);
      } else {
        await this.page.evaluate((t) => {
          localStorage.setItem('jwt_token', t);
        }, token);
      }
    } else if (storageMethod === 'cookie') {
      await this.setAuthCookie(token);
    } else {
      await this.page.evaluate((t, method) => {
        if (method === 'localStorage') {
          localStorage.setItem('jwt_token', t);
        } else {
          sessionStorage.setItem('jwt_token', t);
        }
      }, token, storageMethod);
    }
  }

  private async setAuthCookie(token: string) {
    await this.page.context().addCookies([
      {
        name: 'auth_token',
        value: token,
        url: this.page.url(),
      },
    ]);
  }

  /**
   * Wait for element with browser-specific timing adjustments.
   * Firefox/WebKit need slightly longer waits.
   */
  async waitForElement(selector: string, timeout?: number) {
    const adjustedTimeout = timeout || 7000;
    const browserAdjustedTimeout = this.browserName === 'webkit' ? adjustedTimeout + 1000 : adjustedTimeout;

    await expect(this.page.locator(selector)).toBeVisible({ timeout: browserAdjustedTimeout });
  }

  /**
   * Verify focus outline is visible (varies by browser).
   */
  async verifyFocusOutline(selector: string) {
    const element = this.page.locator(selector);
    const outlineWidth = await element.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseInt(style.outlineWidth);
    });

    const capabilities = this.getCapabilities();
    expect(outlineWidth).toBeGreaterThanOrEqual(capabilities.focusOutlineWidth);
  }

  /**
   * Get storage contents for debugging (handles browser differences).
   */
  async getStorageContents() {
    return await this.page.evaluate(() => {
      return {
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage },
        cookies: document.cookie,
      };
    });
  }

  /**
   * Clear all storage for test isolation.
   */
  async clearAllStorage() {
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Handle browser-specific keyboard events.
   */
  async pressKey(key: string) {
    // Firefox requires explicit waits after key presses
    if (this.browserName === 'firefox') {
      await this.page.keyboard.press(key);
      await this.page.waitForTimeout(100);
    } else {
      await this.page.keyboard.press(key);
    }
  }

  /**
   * Take screenshot with browser-specific settings.
   */
  async takeScreenshot(name: string) {
    // Disable animations for consistent screenshots across browsers
    await this.page.evaluate(() => {
      document.documentElement.style.animationPlayState = 'paused';
    });

    const path = `test-results/${this.browserName}-${name}.png`;
    await this.page.screenshot({
      path,
      fullPage: true,
      animations: 'disabled',
    });

    return path;
  }

  /**
   * Report browser-specific issue or known quirk.
   */
  reportBrowserIssue(issue: string, severity: 'warning' | 'error' = 'warning') {
    console.log(`[${this.browserName.toUpperCase()}] ${severity.toUpperCase()}: ${issue}`);
  }
}

/**
 * Cross-browser test helper for use in tests.
 * Usage in test:
 *   const cbh = new CrossBrowserHelper(page, browserName);
 *   if (cbh.shouldSkipOn('webkit')) test.skip();
 */
export async function withCrossBrowserSupport(
  page: Page,
  browserName: string,
  testFn: (helper: CrossBrowserHelper) => Promise<void>
) {
  const helper = new CrossBrowserHelper(page, browserName as BrowserName);
  await testFn(helper);
}
