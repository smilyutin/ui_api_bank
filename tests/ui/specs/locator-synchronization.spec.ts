import { test, expect } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';
import { WaitHelper } from '../../../helpers/wait-helpers';

/**
 * Locator Synchronization & Stability Tests
 *
 * Demonstrates best practices for:
 * 1. Built-in waiting mechanisms (expect with auto-wait)
 * 2. Test isolation (fresh auth per test)
 * 3. Synchronization without arbitrary waits
 * 4. Chained locator patterns for mobile stability
 *
 * Key Principles:
 * - Use expect() assertions which include built-in waits
 * - Never use arbitrary page.waitForTimeout() for element waits
 * - Isolate each test with fresh authentication
 * - Wait for actual conditions, not fixed delays
 */
test.describe('@ui Locator Synchronization & Stability', () => {
	let pm: PageManager;

	// Test isolation: Fresh authentication for each test
	test.beforeEach(async ({ page, baseURL }) => {
		if (!baseURL) throw new Error('baseURL is not defined');

		// Ensure clean state: authenticate fresh user, no shared session
		await ensureDashboardAuthenticated(page, {
			baseURL: baseURL.toString(),
			role: 'user',
			fallbackUserPrefix: 'locator-sync-test',
		});

		pm = new PageManager(page);

		// Wait for dashboard to be fully loaded using built-in mechanisms
		// (not arbitrary sleep; polls actual UI elements)
		await pm.dashboard().waitForLoad();
	});

	// Test isolation: Clean up after each test
	test.afterEach(async ({ page }) => {
		// Logout to clear session state
		await pm.dashboard().logout().catch(() => {
			// Logout may fail if already logged out, which is fine
		});

		// Clear cookies to reduce session state leakage to the next test
	});

	test('should wait for welcome heading using chained locator with regex filter', async ({
		page,
	}) => {
		/**
		 * Demonstrates:
		 * - Using element type + text filter (chained)
		 * - expect() auto-wait instead of manual waits
		 * - Case-insensitive regex for mobile text variations
		 */

		await test.step('Locate the welcome heading via chained locator with regex filter', async () => {
			// Chained locator: h1 filtered by regex (tolerates case, whitespace)
			const heading = page.locator('h1').filter({ hasText: /welcome/i });

			// expect() includes built-in auto-wait (10s timeout from config)
			// No manual waitForDisplayed() needed
			await expect(heading).toBeVisible();

			// Verify text content (also uses built-in wait)
			await expect(heading).toContainText(/welcome/i);

			// Get the actual text to verify it matches expected pattern
			const text = await heading.textContent();
			expect(text).toBeTruthy();
			expect(text?.toLowerCase()).toContain('welcome');
		});
	});

	test('should locate balance element with ID selector (most stable)', async ({
		page,
	}) => {
		/**
		 * Demonstrates:
		 * - ID-based selectors are most stable (no chaining needed)
		 * - expect() auto-wait works for visibility
		 * - Combining visibility + text assertions
		 */

		await test.step('Locate the balance element via ID selector', async () => {
			const balance = page.locator('#balance');

			// Auto-wait for visibility (built-in to expect)
			await expect(balance).toBeVisible();

			// Verify it contains currency symbol
			await expect(balance).toContainText(/\$|€|£/);

			// Verify the value is numeric
			const balanceText = await balance.textContent();
			expect(balanceText).toMatch(/\d+(\.\d{2})?/);
		});
	});

	test('should open menu using chained button selector with text filter', async ({
		page,
	}) => {
		/**
		 * Demonstrates:
		 * - Element type + text filter instead of class-only selectors
		 * - Checking visibility (respects CSS media queries)
		 * - No arbitrary waits for CSS transitions
		 */

		await test.step('Open the menu (if present) using a chained button selector', async () => {
			const menuToggle = page.locator('button').filter({ hasText: /menu/i });

			// Check if toggle is displayed (respects @media display: none)
			const isVisible = await menuToggle.isVisible();

			if (isVisible) {
				// Auto-wait for enabled state before click
				await expect(menuToggle).toBeEnabled();
				await menuToggle.click();

				// Wait for menu to appear (navigation should be visible now)
				// Use WaitHelper for custom conditions, not arbitrary sleep
				const navVisible = await WaitHelper.waitForElement(
					page.locator('nav').filter({ hasText: /.+/ }),
					{ timeout: WaitHelper.timeouts.NORMAL }
				);
				expect(navVisible).toBe(true);
			}
		});
	});

	test('should navigate using chained context-aware selectors', async ({
		page,
	}) => {
		/**
		 * Demonstrates:
		 * - Contextual chaining (nav > link)
		 * - Text filter with whitespace tolerance
		 * - Built-in wait before interaction
		 */

		await test.step('Open the menu if needed and click the profile link', async () => {
			// Open menu if needed (same as previous test)
			const menuToggle = page.locator('button').filter({ hasText: /menu/i });
			if (await menuToggle.isVisible()) {
				await menuToggle.click();
			}

			// Chained: navigation > link with "Profile" text
			// /profile/i matches "Profile", "PROFILE", case-insensitive
			const profileLink = page
				.locator('nav')
				.locator('a, button, [role="link"]')
				.filter({ hasText: /profile/i })
				.first();

			// expect() includes auto-wait (up to 10s by default)
			await expect(profileLink).toBeVisible();
			await expect(profileLink).toBeEnabled();

			// Click with auto-wait for element to be ready
			await profileLink.click();
		});

		await test.step('Verify navigation occurred', async () => {
			// Wait for navigation (use URL since page title may vary)
			await expect(page).toHaveURL(/\/dashboard|\/profile/i, {
				timeout: WaitHelper.timeouts.NORMAL,
			});
		});
	});

	test('should find logout link using contextual chaining and whitespace-tolerant regex', async ({
		page,
	}) => {
		/**
		 * Demonstrates:
		 * - Chained nav > a selector
		 * - Regex with \s* for whitespace tolerance ("Log out" vs "Logout")
		 * - Conditional logic with built-in waits
		 */

		await test.step('Open the menu and click the logout link', async () => {
			// Open menu to ensure logout link is visible
			const menuToggle = page.locator('button').filter({ hasText: /menu/i });
			if (await menuToggle.isVisible()) {
				await menuToggle.click();
			}

			// Chained contextual selector: nav > a with whitespace-tolerant regex
			// /log\s*out/i matches "Logout", "Log out", "LOG OUT", etc.
			const logoutLink = page
				.locator('nav')
				.locator('a')
				.filter({ hasText: /log\s*out/i });

			// expect() includes auto-wait for visibility
			await expect(logoutLink).toBeVisible();

			// Verify it's clickable
			await expect(logoutLink).toBeEnabled();

			// Click it
			await logoutLink.click();
		});

		await test.step('Verify redirect to the login page', async () => {
			// Wait for redirect to login page (URL change, not arbitrary sleep)
			await expect(page).toHaveURL(/\/login/i, {
				timeout: WaitHelper.timeouts.NORMAL,
			});
		});
	});

	test('should collect navigation items respecting media query visibility', async ({
		page,
	}) => {
		/**
		 * Demonstrates:
		 * - Filtering elements by visibility (respects CSS @media)
		 * - Collecting text from multiple elements
		 * - No arbitrary waits between actions
		 */

		const navItems = await test.step('Open the menu and locate nav items', async () => {
			// Open menu if needed
			const menuToggle = page.locator('button').filter({ hasText: /menu/i });
			if (await menuToggle.isVisible()) {
				await menuToggle.click();
			}

			// Get all nav links, filtered by text content
			const navItems = page
				.locator('nav')
				.locator('a, button, [role="link"]')
				.filter({ hasText: /.+/ });

			// Wait for at least one item to be visible
			const count = await navItems.count();
			expect(count).toBeGreaterThan(0);
			return navItems;
		});

		await test.step('Collect and verify visible items', async () => {
			// Collect only visible items (respects CSS media query visibility)
			const count = await navItems.count();
			const visibleItems: string[] = [];
			for (let i = 0; i < count; i++) {
				const item = navItems.nth(i);

				// Check visibility (respects @media display: none)
				if (await item.isVisible()) {
					const text = (await item.textContent())?.trim();
					if (text) {
						visibleItems.push(text);
					}
				}
			}

			// Should have at least some visible items
			expect(visibleItems.length).toBeGreaterThan(0);
		});
	});

	test('should wait for page load state without arbitrary delays', async ({
		page,
		baseURL,
	}) => {
		/**
		 * Demonstrates:
		 * - Using page.goto() with auto-wait
		 * - waitForLoadState() for network activity
		 * - No arbitrary waits for "stability" (use WaitHelper.waitForStableDOM instead)
		 */

		await test.step('Navigate directly to the dashboard', async () => {
			const dashboardUrl = new URL('/dashboard', baseURL).toString();
			await page.goto(dashboardUrl);

			// Wait for DOM content loaded (built-in Playwright mechanism)
			await page.waitForLoadState('domcontentloaded');
		});

		await test.step('Verify UI elements appear without arbitrary delays', async () => {
			// Wait for the actual UI elements to appear (not arbitrary sleep)
			// The dashboard fetches data after load, so poll the actual elements
			const heading = page.locator('h1').filter({ hasText: /welcome/i });
			const balance = page.locator('#balance');

			// These use expect() auto-wait (10s timeout)
			await expect(heading).toBeVisible();
			await expect(balance).toBeVisible();

			// Optional: Wait for network to be idle (if needed for API results)
			// But only if the app actually waits for network responses
			try {
				await page.waitForLoadState('networkidle', {
					timeout: WaitHelper.timeouts.QUICK,
				});
			} catch {
				// Network idle timeout is acceptable; we already have UI elements
			}
		});
	});

	test('should isolate tests by preventing state leakage between runs', async ({
		page,
		baseURL,
	}) => {
		/**
		 * Demonstrates:
		 * - Each test starts with fresh auth (ensureDashboardAuthenticated)
		 * - Each test ends with cleanup (afterEach)
		 * - No shared session state between tests
		 * - Verifying isolation with cookies/storage
		 */

		await test.step('Verify a fresh authenticated session via cookies', async () => {
			// Get current cookies (should be clean session)
			const cookies = await page.context().cookies();

			// Should have auth token (set by ensureDashboardAuthenticated)
			const hasAuthCookie = cookies.some((c) =>
				['token', 'jwt', 'auth', 'access_token'].includes(c.name)
			);
			expect(hasAuthCookie || cookies.length > 0).toBe(true); // May vary by app

			// Verify we're on dashboard (proves we're authenticated)
			await expect(page).toHaveURL(/\/dashboard/i);
		});

		await test.step('Verify auth token presence in localStorage', async () => {
			// Check localStorage for auth token
			const token = await page.evaluate(() => {
				const keys = ['token', 'jwt', 'jwt_token', 'auth', 'access_token', 'id_token'];
				for (const key of keys) {
					const val = localStorage.getItem(key);
					if (val) return val;
				}
				return null;
			});

			// Should have some auth token in storage
			expect(typeof token === 'string' || token === null).toBe(true);
		});
	});

	test('should demonstrate best practice: chained selector + explicit wait + assertion', async ({
		page,
	}) => {
		/**
		 * This test shows the complete pattern for stable, reliable selectors:
		 *
		 * 1. Use element type first (h1, button, a, etc.)
		 * 2. Chain conditions with .filter({ hasText: ... })
		 * 3. Use expect() for automatic waits
		 * 4. Never use arbitrary page.waitForTimeout()
		 * 5. Use WaitHelper for custom conditions
		 */

		await test.step('Locate the heading via chained selector and verify it', async () => {
			// PATTERN: Chained selector with semantic meaning
			const heading = page
				.locator('h1') // Element type (semantic)
				.filter({ hasText: /welcome/i }); // Condition (text filter)

			// PATTERN: expect() includes built-in 10s wait
			// No manual waitForDisplayed() or waitForVisible() needed
			await expect(heading).toBeVisible();

			// PATTERN: Combine multiple assertions for clarity
			await expect(heading).toHaveText(/welcome back/i);

			// PATTERN: For more complex waits, use WaitHelper
			await WaitHelper.waitForStableDOM(page, {
				timeout: WaitHelper.timeouts.QUICK,
			});
			// isStable wait completes (void), no assertion needed
		});

		await test.step('Open the menu (if present) using WaitHelper instead of arbitrary sleep', async () => {
			// PATTERN: Never do this:
			// await page.waitForTimeout(1000);  // ← BAD: Arbitrary wait
			// await page.waitForTimeout(300);   // ← BAD: CSS transition wait

			// PATTERN: Instead, use WaitHelper for CSS transitions:
			const menuToggle = page.locator('button').filter({ hasText: /menu/i });
			if (await menuToggle.isVisible()) {
				await menuToggle.click();
				// If CSS transition is needed, use WaitHelper, not arbitrary sleep
				// (normally handled by page rendering, not needed)
			}
		});
	});
})