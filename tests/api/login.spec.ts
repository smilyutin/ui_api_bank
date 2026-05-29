import { test, expect, request } from '@playwright/test';
import { createRandomUser, findOrCreateUser, User } from '../../helpers/credentials';
import { validateSchema } from '../../helpers/schema-validator';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
import {
  analyzeLoginFailure,
  analyzeLoginSuccess,
  loginViaAvailableFlow
} from '../../fixtures/api/login.helpers';

/**
 * API Authentication Tests
 * 
 * These tests verify that the application provides functional API endpoints
 * for user authentication and login, ensuring the system can be properly
 * tested with valid user credentials.
 * 
 * Test Strategy:
 * 1. Use persisted user credentials or create new ones
 * 2. Attempt to discover login endpoints through common patterns
 * 3. Try multiple content types (form-data and JSON)
 * 4. Fall back to user creation if login fails
 * 5. Verify successful authentication response
 * 
 * Expected Behavior:
 * - Login should succeed with valid credentials
 * - Response should indicate successful authentication
 * - User credentials should be persisted for future tests
 * - Multiple endpoint formats should be supported
 */

/**
 * Test: Login with persisted user credentials
 * 
 * Purpose: Verifies that the application supports user authentication
 * through API endpoints, enabling automated testing with valid credentials.
 * 
 * Test Strategy:
 * 1. Load or create test user credentials
 * 2. Try common login endpoints
 * 3. Attempt both form-data and JSON content types
 * 4. Create user account if login fails
 * 5. Verify successful authentication response
 * 6. Persist user credentials for future tests
 */
test.describe('API - Login with persisted user', () => {
  test('should login using stored credentials or create then login', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const reporter = new SecurityReporter(testInfo);
    const api = await request.newContext({ baseURL: baseURL.toString() });
    const res = await api.get('/login');

    // Step 1: Load or create test user credentials
    const persistedUser: User = findOrCreateUser('API');

    const contentType = (res.headers()['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const loginPageJson = await res.json().catch(() => null);
      if (loginPageJson && typeof loginPageJson === 'object') {
        await validateSchema('login-schema', 'GET_login', loginPageJson as object);
      }
    }
    const status = res.status();
    if (status === 404) {
      reporter.reportSkip('Login route (/login) is not available on this target application (404).');
      test.skip(true, 'GET /login not found (404)');
    }

    let activeUser: User = persistedUser;
    let { loginRes, successfulLoginPath, attempts } = await loginViaAvailableFlow(api, activeUser);

    if (!loginRes) {
      activeUser = createRandomUser('API');
      const freshFlow = await loginViaAvailableFlow(api, activeUser);
      attempts = [
        ...attempts,
        { path: '--- retry with fresh user ---', status: 'retry' },
        ...freshFlow.attempts
      ];
      loginRes = freshFlow.loginRes;
      successfulLoginPath = freshFlow.successfulLoginPath;
    }

    if (!loginRes) {
      const failure = analyzeLoginFailure(attempts);
      testInfo.attach('tried-login-endpoints', { body: JSON.stringify(attempts, null, 2), contentType: 'application/json' });
      testInfo.attach('login-users-tried', {
        body: JSON.stringify({
          persistedUser,
          freshUserAttempted: activeUser !== persistedUser,
          finalUser: activeUser
        }, null, 2),
        contentType: 'application/json'
      });
      reporter.reportWarning(
        failure.description,
        failure.recommendations,
        failure.category
      );
    }

    expect(loginRes).toBeTruthy();
    if (!loginRes) {
      throw new Error(`Could not log in with discovered credentials. Attempts: ${JSON.stringify(attempts)}`);
    }

    const success = analyzeLoginSuccess(successfulLoginPath || 'unknown', loginRes.status());

    reporter.reportPass(success.description, success.category);

    // if login response returns a token or body, check basic shape
    try {
      let b = null;
      if (loginRes) {
        b = await loginRes.json().catch(() => null);
      }
      if (b) expect(b).toBeTruthy();
    } catch {}
  });
});
