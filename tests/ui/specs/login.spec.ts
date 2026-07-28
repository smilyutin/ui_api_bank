import { test, expect, request } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { findOrCreateUser, createRandomUser } from '../../../helpers/credentials';
import { loginViaAvailableFlow } from '../../../fixtures/api/login.helpers';

/**
 * Login UI Tests
 *
 * These tests verify that the login form accepts valid credentials,
 * rejects invalid ones, and properly navigates to the dashboard on success.
 *
 * Test Strategy:
 * 1. Ensure test user exists via API (create if needed).
 * 2. Navigate directly to the /login page (no pre-authentication).
 * 3. Drive the login form through the LoginPage POM.
 * 4. Verify successful authentication redirects to the dashboard.
 * 5. Verify error handling for invalid scenarios.
 */

test.describe('User login', () => {
  let pm: PageManager;

  test.beforeEach(async ({ page }) => {
    pm = new PageManager(page);
  });

  test('should login successfully with valid credentials and redirect to dashboard', async ({ baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const user = findOrCreateUser('login-ui');
    const api = await request.newContext({ baseURL: baseURL.toString() });

    await loginViaAvailableFlow(api, user);
    await api.dispose();

    const login = pm.login();
    const identifier = user.username || user.email;
    if (!identifier) throw new Error('User has no username or email');

    await login.goto(baseURL);
    await login.fillEmail(identifier);
    await login.fillPassword(user.password);
    await login.submit();

    await pm.dashboard().waitForLoad();
  });

  test('should reject login with incorrect password', async ({ baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const user = findOrCreateUser('login-ui-invalid');
    const api = await request.newContext({ baseURL: baseURL.toString() });

    await loginViaAvailableFlow(api, user);
    await api.dispose();

    const login = pm.login();
    const identifier = user.username || user.email;
    if (!identifier) throw new Error('User has no username or email');

    await login.goto(baseURL);
    await login.fillEmail(identifier);
    await login.fillPassword(`${user.password}-wrong`);
    await login.submit();

    // Verify we remain on the login page (not redirected to dashboard)
    await expect(pm.login().page).toHaveURL(/\/login(?:[?#].*)?$/i);
  });

  test('should handle form submission with empty username', async ({ baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const login = pm.login();

    await login.goto(baseURL);
    await login.fillPassword('anypassword');
    await login.submit();

    // Verify we remain on the login page
    await expect(login.page).toHaveURL(/\/login(?:[?#].*)?$/i);
  });

  test('should handle form submission with empty password', async ({ baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const user = createRandomUser('login-ui-empty-pass');
    const login = pm.login();
    const identifier = user.username || user.email;
    if (!identifier) throw new Error('User has no username or email');

    await login.goto(baseURL);
    await login.fillEmail(identifier);
    // Don't fill password
    await login.submit();

    // Verify we remain on the login page
    await expect(login.page).toHaveURL(/\/login(?:[?#].*)?$/i);
  });
});
