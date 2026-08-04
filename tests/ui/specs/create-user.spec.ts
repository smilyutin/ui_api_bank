import { test, expect, request } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { createRandomUser, findOrCreateUser } from '../../../helpers/credentials';
import { loggedExpect, setupAssertionLogging, endAssertionLogging } from '../../../helpers/expect-logger';

/**
 * UI User Registration Tests
 *
 * These tests verify that the application provides a functional user interface
 * for user registration and account creation, ensuring the system can be
 * properly tested with valid user credentials through the UI.
 *
 * Test Strategy:
 * 1. Create fresh random user credentials for each test
 * 2. Navigate to registration page
 * 3. Fill registration form using Page Object Model
 * 4. Submit form and verify success
 * 5. Persist user credentials for future tests
 *
 * Expected Behavior:
 * - Registration form should be accessible
 * - Form fields should accept valid input
 * - Submission should create user account
 * - Success should be indicated through navigation or message
 * - User credentials should be persisted
 */

/**
 * Test: Create user account via UI
 *
 * Purpose: Verifies that the application supports user account creation
 * through the user interface, enabling automated testing with valid credentials.
 *
 * Test Strategy:
 * 1. Generate fresh random user credentials
 * 2. Navigate to registration page
 * 3. Fill email and password fields using POM
 * 4. Submit registration form
 * 5. Wait for success indication (navigation or message)
 * 6. Verify registration was successful
 * 7. Persist user credentials for future tests
 */
test.describe('@ui @feature:create-user UI - Create user account', () => {
  test('should create a user via UI', async ({ page, baseURL }) => {
    setupAssertionLogging('should create a user via UI');
    if (!baseURL) throw new Error('baseURL is not defined');
    const pm = new PageManager(page);
    const register = pm.register();

    const user = createRandomUser('UI', false);
    if (!user.email || !user.password) {
      throw new Error('User email or password is undefined');
    }
    const { email, password } = user;

    await test.step('Fill and submit the registration form', async () => {
      await register.goto(baseURL.toString());

      const filledEmail = await register.fillEmail(email);
      const filledPassword = await register.fillPassword(password);
      const clicked = await register.submit();

      loggedExpect(filledEmail, 'filledEmail').toBeTruthy();
      loggedExpect(filledPassword, 'filledPassword').toBeTruthy();
      loggedExpect(clicked, 'clicked').toBeTruthy();
    });

    await test.step('Verify registration succeeded', async () => {
      // Wait for success indication (navigation or success message)
      try {
        await Promise.race([
          expect(page.getByText('Registration successful! Proceed to login')).toBeVisible({ timeout: 5000 }),
          expect(page).toHaveURL(/\/login/i, { timeout: 5000 }),
        ]);
      } catch {
        // Either condition may not be met, but we check both below
      }

      const successMessage = await page.getByText('Registration successful! Proceed to login').count() > 0;
      const onLogin = /\/login/i.test(page.url());
      loggedExpect(Boolean(successMessage) || onLogin, 'registration success').toBeTruthy();
    });

    const freshToken = await test.step('Log in with the new user and capture a fresh token', async () => {
      const login = pm.login();
      await login.goto(baseURL.toString());
      await login.fillEmail(email);
      await login.fillPassword(password);
      await login.submit();

      await expect(page).toHaveURL(/\/dashboard(?:[?#].*)?$/i, { timeout: 7000 });
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 7000 });

      const storageToken = await page.evaluate(() => {
        const keys = ['jwt_token', 'token', 'jwt', 'access_token', 'id_token', 'auth'];
        for (const key of keys) {
          const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
          if (value) return value;
        }
        return null;
      });

      const cookies = await page.context().cookies();
      const cookieToken =
        cookies.find(c => ['token', 'jwt', 'access_token', 'auth_token'].includes(c.name))?.value || null;

      const freshToken = storageToken || cookieToken;
      loggedExpect(freshToken, 'freshToken').toBeTruthy();
      return freshToken;
    });

    await test.step('Persist credentials for future tests', async () => {
      // Set the fresh token in environment for future API calls in this test session
      if (freshToken) {
        process.env.API_AUTH_TOKEN = freshToken;
      }
      endAssertionLogging('passed');
    });
  });

  test('should show an error and not proceed to login when registering a duplicate username', async ({ page, baseURL }) => {
    setupAssertionLogging('should show an error and not proceed to login when registering a duplicate username');
    if (!baseURL) throw new Error('baseURL is not defined');
    const pm = new PageManager(page);
    const register = pm.register();

    // Create a test user first
    const testUser = createRandomUser('dup-check');
    const userIdentifier = testUser.email || testUser.username;

    if (!userIdentifier) {
      throw new Error('Test user must have username or email');
    }

    // Register the user via API first
    await test.step('Register the user first', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      try {
        const res = await api.post('/register', {
          data: JSON.stringify({
            username: userIdentifier,
            password: testUser.password,
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok()) {
          throw new Error(`Failed to register test user: ${res.status()}`);
        }
      } finally {
        await api.dispose();
      }
    });

    // Try to register the same user again
    await test.step('Register with the same username again', async () => {
      await register.goto(baseURL.toString());
      await register.fillEmail(userIdentifier);
      await register.fillPassword('SomeOtherPassword123!');
      await register.submit();
    });

    await test.step('Verify the duplicate was rejected', async () => {
      await expect(page.locator('#message')).toHaveText(/already exists/i, { timeout: 5000 });
      loggedExpect(page.url(), 'page.url').not.toContain('/login');
      endAssertionLogging('passed');
    });
  });
});
