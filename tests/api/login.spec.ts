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

    // GET /login always serves the HTML login page (never JSON), so there is
    // no JSON body to schema-validate here — the real login response schema
    // is validated below, against the POST /login JSON response instead.
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
    const b = loginRes ? await loginRes.json().catch(() => null) : null;
    if (b) {
      expect(b).toBeTruthy();
      // Schema is generated against the real POST /login contract; other
      // discovered candidate paths (/api/auth/login, /api/login, etc.)
      // aren't guaranteed to share that exact shape.
      if ((successfulLoginPath || '').startsWith('/login (')) {
        await validateSchema('login-schema', 'POST_login', b);
      }
    }
  });
});

/**
 * These tests cover POST /login directly (the route used by
 * loginViaAvailableFlow above) with malformed and malicious credentials,
 * rather than only the happy path exercised earlier in this file.
 */
test.describe('API - Login validation and security', () => {
  test('POST /login should reject a valid username with an incorrect password', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const user = findOrCreateUser('login-invalid-check');
    const api = await request.newContext({ baseURL: baseURL.toString() });

    const res = await api.post('/login', {
      data: { username: user.username || user.email, password: `${user.password}-wrong` },
      headers: { 'Content-Type': 'application/json' }
    });
    const status = res.status();
    const body = await res.json().catch(() => null);
    await api.dispose();

    expect(status).toBe(401);
    expect(body?.status).toBe('error');

    reporter.reportPass(
      'Login endpoint rejected a valid username paired with an incorrect password.',
      'API2:2023 - Broken Authentication'
    );
  });

  test('POST /login should not allow authentication bypass via SQL injection in username', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });

    // Classic tautology payload targeting the unparameterized query in
    // app.py (`SELECT * FROM users WHERE username='{username}' AND
    // password='{password}'`): closes the username literal, forces the
    // WHERE clause true, and comments out the password check.
    const res = await api.post('/login', {
      data: { username: `' OR '1'='1' -- `, password: 'irrelevant' },
      headers: { 'Content-Type': 'application/json' }
    });
    const status = res.status();
    const body = await res.json().catch(() => null);
    await api.dispose();

    testInfo.attach('sqli-login-probe', {
      body: JSON.stringify({ status, body }, null, 2),
      contentType: 'application/json'
    });

    const bypassed = status === 200 && body?.status === 'success' && Boolean(body?.token);

    if (bypassed) {
      reporter.reportVulnerability(
        'API2_AUTH',
        {
          endpoint: '/login',
          technique: "SQL injection tautology in 'username' (' OR '1'='1' -- )",
          responseStatus: status,
          authenticatedAs: body?.debug_info?.username,
          isAdmin: body?.isAdmin
        },
        [
          'Use parameterized queries/prepared statements for the login lookup instead of string-interpolating the query.',
          'Never build SQL by interpolating request input directly (app.py: f-string SELECT in the /login handler).',
          'Add input validation that rejects SQL metacharacters in identifier-style fields as defense in depth.'
        ]
      );
    } else {
      expect(status).toBe(401);
      reporter.reportPass(
        'Login endpoint rejected a SQL injection tautology payload in the username field.',
        'API2:2023 - Broken Authentication'
      );
    }
  });
});
