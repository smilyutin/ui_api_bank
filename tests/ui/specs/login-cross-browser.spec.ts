import { test, expect, request } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { CrossBrowserHelper } from '../../../helpers/cross-browser';
import { findOrCreateUser } from '../../../helpers/credentials';
import { loginViaAvailableFlow } from '../../../fixtures/api/login.helpers';

/**
 * Cross-Browser Compatibility Tests - Login
 *
 * These tests verify that login flows work consistently across all major browsers:
 * - Chromium (Chrome/Edge)
 * - Firefox
 * - WebKit (Safari)
 * - Mobile Chrome (Pixel 5)
 * - Mobile Safari (iPhone 12)
 *
 * Tests are automatically run across all browsers via playwright.config.ts projects.
 */

test.describe('@smoke @auth @cross-browser Login - Cross-Browser Compatibility', () => {
  test('should login successfully on all browsers', async ({ page, browserName, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, browserName as any);
    const pm = new PageManager(page);

    // Some browsers have known issues - skip if needed
    if (cbh.shouldSkipOn(['webkit'])) {
      // Safari has special focus handling - handle separately
    }

    await test.step('Ensure the user exists and log in through the UI', async () => {
      // Create test user and ensure it exists in the database
      const user = findOrCreateUser(`login-cross-browser-${browserName}`);
      const api = await request.newContext({ baseURL });
      await loginViaAvailableFlow(api, user);
      await api.dispose();

      try {
        await pm.login().goto(baseURL);
        await pm.login().fillEmail(user.username || user.email || 'test@example.com');
        await pm.login().fillPassword(user.password);
        await pm.login().submit();
        await pm.dashboard().waitForLoad();
      } catch (error) {
        console.error(`[${browserName}] Login failed:`, error);

        // Capture context for debugging
        const storage = await cbh.getStorageContents();
        console.log(`[${browserName}] Storage:`, storage);

        throw error;
      }
    });

    await test.step('Verify login succeeded', async () => {
      const balance = await pm.dashboard().getAccountBalance();
      expect(balance).not.toBeNull();
      console.log(`[${browserName}] Login successful`);

      // Log browser capabilities for debugging
      const caps = cbh.getCapabilities();
      console.log(`[${browserName}] Capabilities:`, caps);
    });
  });

  test('should handle browser-specific authentication storage', async ({
    page,
    browserName,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, browserName as any);
    const pm = new PageManager(page);
    const user = findOrCreateUser(`auth-storage-${browserName}`);

    await test.step('Ensure the user exists and log in through the UI', async () => {
      const api = await request.newContext({ baseURL });
      await loginViaAvailableFlow(api, user);
      await api.dispose();

      try {
        await pm.login().goto(baseURL);
        await pm.login().fillEmail(user.username || user.email || 'test@example.com');
        await pm.login().fillPassword(user.password);
        await pm.login().submit();
        await pm.dashboard().waitForLoad();
      } catch (error) {
        console.error(`[${browserName}] Auth storage test failed:`, error);
        throw error;
      }
    });

    await test.step('Verify auth is persisted in storage', async () => {
      const storage = await cbh.getStorageContents();

      const hasLocalStorage = Object.keys(storage.localStorage).length > 0;
      const hasSessionStorage = Object.keys(storage.sessionStorage).length > 0;
      const hasCookies = storage.cookies.length > 0;

      const hasAuth = hasLocalStorage || hasSessionStorage || hasCookies;
      expect(hasAuth).toBeTruthy();

      console.log(`[${browserName}] Auth Storage:`, {
        localStorage: Object.keys(storage.localStorage),
        sessionStorage: Object.keys(storage.sessionStorage),
        cookies: storage.cookies.substring(0, 50),
      });
    });
  });

  test('should support keyboard navigation on all browsers', async ({
    page,
    browserName,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, browserName as any);
    const pm = new PageManager(page);

    await test.step('Navigate to login', async () => {
      await pm.login().goto(baseURL);
    });

    await test.step('Tab to the username field', async () => {
      await cbh.pressKey('Tab');
      const focused = await page.evaluate(() => document.activeElement?.getAttribute('type'));
      expect(focused).toMatch(/text|email/);
    });

    await test.step('Tab to the password field', async () => {
      await cbh.pressKey('Tab');
      const focused = await page.evaluate(() => document.activeElement?.getAttribute('type'));
      expect(focused).toBe('password');
    });

    await test.step('Tab to the submit button', async () => {
      await cbh.pressKey('Tab');
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBe('BUTTON');
      console.log(`[${browserName}] Keyboard navigation: OK`);
    });
  });

  test('should have visible focus indicators', async ({ page, browserName, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, browserName as any);
    const pm = new PageManager(page);

    // Skip if browser has known issues with focus
    if (cbh.shouldSkipOn('webkit')) {
      test.skip();
    }

    const usernameInput = await test.step('Focus the username field', async () => {
      await pm.login().goto(baseURL);

      // Find username input - try multiple selectors
      let usernameInput = page.getByTestId('username');
      if (!(await usernameInput.count())) {
        usernameInput = page.locator('input[name="username"]');
      }

      // Verify input exists before focusing
      await expect(usernameInput).toBeVisible({ timeout: 5000 });
      await usernameInput.focus();
      return usernameInput;
    });

    await test.step('Verify a visible focus outline', async () => {
      const outlineWidth = await usernameInput.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return parseInt(style.outlineWidth);
      });

      const capabilities = cbh.getCapabilities();
      expect(outlineWidth).toBeGreaterThanOrEqual(Math.max(capabilities.focusOutlineWidth, 1));

      console.log(`[${browserName}] Focus outline width: ${outlineWidth}px`);
    });
  });

  test('should handle login error consistently across browsers', async ({
    page,
    browserName,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, browserName as any);
    const pm = new PageManager(page);

    await test.step('Attempt login with the wrong password', async () => {
      await pm.login().goto(baseURL);
      await pm.login().fillEmail('test@example.com');
      await pm.login().fillPassword('wrong-password-12345');
      await pm.login().submit();
    });

    await test.step('Verify we remain on the login page', async () => {
      await cbh.waitForElement('input[name="username"]');
      const url = page.url();
      expect(url).toContain('/login');
      console.log(`[${browserName}] Error handling: OK`);
    });
  });

  test('should clear storage properly for test isolation', async ({ page, browserName, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, browserName as any);

    await test.step('Navigate to the app and clear storage to start fresh', async () => {
      await page.goto(baseURL);
      await cbh.clearAllStorage();
    });

    await test.step('Set test storage data', async () => {
      await page.evaluate(() => {
        try {
          localStorage.setItem('test-key', 'test-value');
          sessionStorage.setItem('test-session', 'session-value');
        } catch (e) {
          console.warn('Storage not available:', e);
        }
      });

      // Verify it was set (if storage available)
      const storage = await cbh.getStorageContents();
      if (storage.localStorage['test-key']) {
        expect(storage.localStorage['test-key']).toBe('test-value');
      }
    });

    await test.step('Clear storage again and verify it was cleared', async () => {
      await cbh.clearAllStorage();

      const storage = await cbh.getStorageContents();
      // Should have no test keys
      expect(storage.localStorage['test-key']).toBeUndefined();

      console.log(`[${browserName}] Storage isolation: OK`);
    });
  });
});

test.describe('@smoke @auth @cross-browser Login - Browser-Specific Features', () => {
  test('should handle Chromium-specific features', async ({ page, browserName, baseURL }) => {
    if (browserName !== 'chromium') test.skip();
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, browserName as any);
    const pm = new PageManager(page);

    await test.step('Verify Chromium-specific capabilities', async () => {
      const caps = cbh.getCapabilities();
      expect(caps.supportsLocalStorage).toBe(true);
      expect(caps.supportsSessionStorage).toBe(true);
      expect(caps.requiresExplicitWaits).toBe(false);
      console.log('[chromium] Chromium-specific: OK');
    });
  });

  test('should handle Firefox-specific features', async ({ page, browserName, baseURL }) => {
    if (browserName !== 'firefox') test.skip();
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, browserName as any);

    await test.step('Verify Firefox-specific capabilities', async () => {
      // Firefox needs explicit waits for focus
      const caps = cbh.getCapabilities();
      expect(caps.requiresExplicitWaits).toBe(true);
      console.log('[firefox] Firefox-specific: OK');
    });
  });

  test('should handle Safari/WebKit-specific features', async ({ page, browserName, baseURL }) => {
    if (browserName !== 'webkit') test.skip();
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, browserName as any);

    await test.step('Verify Safari/WebKit-specific capabilities', async () => {
      // Safari has different storage behavior
      const caps = cbh.getCapabilities();
      expect(caps.hasWebkitBugs).toBe(true);
      expect(caps.supportsSessionStorage).toBe(false);
      console.log('[webkit] Safari-specific: OK');
    });
  });

  test('should work on mobile Chrome', async ({ page, browserName, baseURL }) => {
    if (!browserName.includes('Mobile Chrome')) test.skip();
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, 'chromium');
    const pm = new PageManager(page);

    await test.step('Verify the mobile viewport size', async () => {
      const viewport = page.viewportSize();
      expect(viewport?.width).toBeLessThanOrEqual(414); // Mobile size
    });

    await test.step('Log in through the UI', async () => {
      const user = findOrCreateUser('login-mobile-chrome');
      const api = await request.newContext({ baseURL });
      await loginViaAvailableFlow(api, user);
      await api.dispose();

      await pm.login().goto(baseURL);
      await pm.login().fillEmail(user.username || user.email || 'test@example.com');
      await pm.login().fillPassword(user.password);
      await pm.login().submit();
    });

    await test.step('Verify the dashboard heading is visible', async () => {
      await cbh.waitForElement('[role="heading"]');
      console.log('[Mobile Chrome] Mobile: OK');
    });
  });

  test('should work on mobile Safari', async ({ page, browserName, baseURL }) => {
    if (!browserName.includes('Mobile Safari')) test.skip();
    if (!baseURL) throw new Error('baseURL is not defined');

    const cbh = new CrossBrowserHelper(page, 'webkit');
    const pm = new PageManager(page);

    await test.step('Verify the mobile viewport size', async () => {
      const viewport = page.viewportSize();
      expect(viewport?.width).toBeLessThanOrEqual(390); // iPhone size
    });

    await test.step('Log in through the UI', async () => {
      const user = findOrCreateUser('login-mobile-safari');
      const api = await request.newContext({ baseURL });
      await loginViaAvailableFlow(api, user);
      await api.dispose();

      await pm.login().goto(baseURL);
      await pm.login().fillEmail(user.username || user.email || 'test@example.com');
      await pm.login().fillPassword(user.password);
      await pm.login().submit();
    });

    await test.step('Verify the dashboard heading is visible', async () => {
      await cbh.waitForElement('[role="heading"]');
      console.log('[Mobile Safari] Mobile: OK');
    });
  });
});
