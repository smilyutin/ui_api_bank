import { test, expect, request } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { findOrCreateUser, createRandomUser } from '../../../helpers/credentials';
import { loginViaAvailableFlow } from '../../../fixtures/api/login.helpers';
import { loggedExpect, setupAssertionLogging, endAssertionLogging, setTestContext } from '../../../helpers/expect-logger';

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
    setupAssertionLogging('should login successfully with valid credentials and redirect to dashboard');
    if (!baseURL) throw new Error('baseURL is not defined');

    const user = findOrCreateUser('login-ui');
    setTestContext({
      user: { username: user.username, email: user.email, role: 'user' },
      url: baseURL,
      password: '***' + user.password.slice(-4),
      action: 'login_with_valid_credentials',
    });

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
    setTestContext({ uiState: 'dashboard_loaded' });
    endAssertionLogging('passed');
  });

  test('should reject login with incorrect password', async ({ baseURL }) => {
    setupAssertionLogging('should reject login with incorrect password');
    if (!baseURL) throw new Error('baseURL is not defined');

    const user = findOrCreateUser('login-ui-invalid');
    const wrongPassword = `${user.password}-wrong`;

    setTestContext({
      user: { username: user.username, email: user.email, role: 'user' },
      url: baseURL,
      password: '***' + wrongPassword.slice(-4),
      action: 'login_with_wrong_password',
      correctPassword: '***' + user.password.slice(-4),
    });

    const api = await request.newContext({ baseURL: baseURL.toString() });

    await loginViaAvailableFlow(api, user);
    await api.dispose();

    const login = pm.login();
    const identifier = user.username || user.email;
    if (!identifier) throw new Error('User has no username or email');

    await login.goto(baseURL);
    await login.fillEmail(identifier);
    await login.fillPassword(wrongPassword);
    await login.submit();

    setTestContext({ uiState: 'still_on_login_page', expectedBehavior: 'reject_invalid_password' });

    // Verify we remain on the login page (not redirected to dashboard)
    await expect(pm.login().page).toHaveURL(/\/login(?:[?#].*)?$/i);
    endAssertionLogging('passed');
  });

  test('should handle form submission with empty username', async ({ baseURL }) => {
    setupAssertionLogging('should handle form submission with empty username');
    if (!baseURL) throw new Error('baseURL is not defined');

    setTestContext({
      url: baseURL,
      username: '',
      password: 'anypassword',
      action: 'login_empty_username',
      expectedBehavior: 'reject_and_stay_on_login',
    });

    const login = pm.login();

    await login.goto(baseURL);
    await login.fillPassword('anypassword');
    await login.submit();

    setTestContext({ uiState: 'still_on_login_page', validationError: 'username_required' });

    // Verify we remain on the login page
    await expect(login.page).toHaveURL(/\/login(?:[?#].*)?$/i);
    endAssertionLogging('passed');
  });

  test('should handle form submission with empty password', async ({ baseURL }) => {
    setupAssertionLogging('should handle form submission with empty password');
    if (!baseURL) throw new Error('baseURL is not defined');

    const user = createRandomUser('login-ui-empty-pass');
    setTestContext({
      url: baseURL,
      username: user.username || user.email,
      password: '',
      action: 'login_empty_password',
      expectedBehavior: 'reject_and_stay_on_login',
    });

    const login = pm.login();
    const identifier = user.username || user.email;
    if (!identifier) throw new Error('User has no username or email');

    await login.goto(baseURL);
    await login.fillEmail(identifier);
    // Don't fill password
    await login.submit();

    setTestContext({ uiState: 'still_on_login_page', validationError: 'password_required' });

    // Verify we remain on the login page
    await expect(login.page).toHaveURL(/\/login(?:[?#].*)?$/i);
    endAssertionLogging('passed');
  });
});
