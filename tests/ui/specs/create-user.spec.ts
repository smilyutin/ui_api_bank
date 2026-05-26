import { test, expect } from '@playwright/test';
import { RegisterPage } from '../page-objects/register.page';
import { LoginPage } from '../page-objects/login.page';
import { saveStoredToken, saveUser, createRandomUser } from '../../utils/credentials';

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
test.describe('UI - Create user account', () => {
  test('should create a user via UI', async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const register = new RegisterPage(page);

    // Step 1: Generate fresh random user credentials for this test
    const user = createRandomUser('UI', false);
    await register.goto(baseURL.toString());

    // Step 2: Use Page Object Model to fill and submit form
    if (!user.email || !user.password) {
      throw new Error('User email or password is undefined');
    }
    const filledEmail = await register.fillEmail(user.email);
    const filledPassword = await register.fillPassword(user.password);
    const clicked = await register.submit();

    // Step 3: Verify form interaction was successful
    expect(filledEmail).toBeTruthy();
    expect(filledPassword).toBeTruthy();
    expect(clicked).toBeTruthy();

    // Step 4: Wait for success indication (navigation or success message)
    await Promise.race([
      page.waitForSelector('text=Registration successful! Proceed to login', { timeout: 5000 }).catch(() => null),
      page.waitForURL(/\/login/i, { timeout: 5000 }).catch(() => null),
    ]);

    // Step 5: Verify registration was successful
    const sawSuccess = await page.$('text=Registration successful! Proceed to login');
    const onLogin = /\/login/i.test(page.url());
    expect(Boolean(sawSuccess) || onLogin).toBeTruthy();

    // Step 6: Login with the newly created user to verify credentials and capture a fresh token
    const login = new LoginPage(page);
    await login.goto(baseURL.toString());
    await login.fillEmail(user.email);
    await login.fillPassword(user.password);
    await login.submit();

    await Promise.race([
      page.waitForURL(/\/dashboard|\/$/i, { timeout: 7000 }).catch(() => null),
      page.waitForLoadState('networkidle').catch(() => null),
    ]);

    expect(page.url()).not.toContain('/login');

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
    expect(freshToken).toBeTruthy();

    // Step 7: Persist single shared user credentials and token for all tests
    saveUser(user, { replace: true });
    if (freshToken) {
      saveStoredToken(freshToken, 'user');
      process.env.API_AUTH_TOKEN = freshToken;
    }

  });
});
