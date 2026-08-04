import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
import { validateSchema } from '../../helpers/schema-validator';
import { findOrCreateUser } from '../../helpers/credentials';
import {
  analyzeCreateUserFailure,
  analyzeCreateUserSuccess,
  createUserViaAvailableFlow,
  EXTENDED_SUCCESS_STATUSES,
  type CreatePayload
} from '../../fixtures/api/create-user.helpers';

test.describe('API - Create user account', () => {
  test('should create a user via API', async ({ baseURL, browser }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const reporter = new SecurityReporter(testInfo);
    const apiContext = await request.newContext({ baseURL: baseURL.toString() });

    const payload: CreatePayload = await test.step('Generate test credentials', async () => {
      const random = Math.random().toString(36).substring(2, 8);
      return {
        email: `API+${random}@example.com`,
        password: 'Password123!'
      };
    });

    const { result, tried } = await test.step('Create the user via the best available flow', async () => {
      return createUserViaAvailableFlow(apiContext, browser, baseURL.toString(), payload);
    });

    if (!result) {
      const failure = analyzeCreateUserFailure(tried);
      testInfo.attach('tried-endpoints', { body: JSON.stringify(tried, null, 2), contentType: 'application/json' });
      reporter.reportWarning(
        failure.description,
        failure.recommendations,
        failure.category
      );
      throw new Error(`Could not find a user-creation endpoint. Tried: ${JSON.stringify(tried)}`);
    }

    await test.step('Verify creation succeeded and matches the API contract', async () => {
      expect(EXTENDED_SUCCESS_STATUSES).toContain(result.response.status());
      const body = await result.response.json().catch(() => null);
      if ([200, 201].includes(result.response.status())) {
        expect(body).toBeTruthy();
        // Schema is generated against the real POST /register contract; other
        // discovered candidate paths aren't guaranteed to share that shape.
        if (result.path.startsWith('/register (')) {
          await validateSchema('register-schema', 'POST_register', body);
        }
      }
    });

    const success = analyzeCreateUserSuccess(result);

    reporter.reportPass(
      success.description,
      success.category
    );
  });

  test('POST /register should reject a duplicate username', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const { status, body } = await test.step('Register with a username that already exists', async () => {
      const existing = findOrCreateUser('create-user-dup-check');
      const api = await request.newContext({ baseURL: baseURL.toString() });

      const res = await api.post('/register', {
        // Both the API and UI registration flows in this suite register the
        // account with `email` as the username value (create-user.helpers.ts,
        // RegisterPage.fillEmail), so that's what must be resubmitted here to
        // actually collide with the existing row.
        data: { username: existing.email || existing.username, password: 'Password123!' },
        headers: { 'Content-Type': 'application/json' }
      });
      const status = res.status();
      const body = await res.json().catch(() => null);
      await api.dispose();
      return { status, body };
    });

    await test.step('Verify the duplicate registration was rejected', async () => {
      expect(status).toBe(400);
      expect(body?.status).toBe('error');

      reporter.reportPass(
        'Registration endpoint rejected a username that was already taken.',
        'API9:2023 - Improper Inventory Management'
      );
    });
  });

  test('POST /register should not let extra request fields grant admin privileges (mass assignment)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const { status, body } = await test.step('Attempt to self-register with is_admin=true', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      const random = Math.random().toString(36).substring(2, 8);

      // /register binds every JSON key that isn't 'username'/'password' straight
      // onto the INSERT (app.py: "Include any additional parameters from user
      // input"). is_admin is a legitimate DB column (database.py), so this
      // probes whether a self-registering user can grant themselves admin.
      const res = await api.post('/register', {
        data: {
          username: `mass-assign-${random}`,
          password: 'Password123!',
          is_admin: true
        },
        headers: { 'Content-Type': 'application/json' }
      });
      const status = res.status();
      const body = await res.json().catch(() => null);
      await api.dispose();

      testInfo.attach('register-mass-assignment-probe', {
        body: JSON.stringify({ status, body }, null, 2),
        contentType: 'application/json'
      });
      return { status, body };
    });

    await test.step('Verify is_admin was not granted', async () => {
      const grantedAdmin = status === 200 && body?.debug_data?.is_admin === true;

      if (grantedAdmin) {
        reporter.reportVulnerability(
          'API6_MASS_ASSIGNMENT',
          {
            endpoint: '/register',
            fieldSubmitted: 'is_admin=true',
            responseStatus: status,
            createdUsername: body?.debug_data?.username
          },
          [
            'Build the INSERT from an explicit allowlist of registration fields (username, password) instead of iterating over every key in the request body.',
            'Never accept is_admin, balance, or account_number from client-supplied registration data.'
          ]
        );
      } else {
        expect(body?.debug_data?.is_admin).not.toBe(true);
        reporter.reportPass(
          'Registration endpoint did not honor a client-supplied is_admin field.',
          'API6:2023 - Unrestricted Access to Sensitive Business Flows'
        );
      }
    });
  });
});
