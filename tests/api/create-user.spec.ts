import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
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

    // Step 1: Generate random test credentials
    const random = Math.random().toString(36).substring(2, 8);
    const payload: CreatePayload = {
      email: `API+${random}@example.com`,
      password: 'Password123!'
    };

    const { result, tried } = await createUserViaAvailableFlow(apiContext, browser, baseURL.toString(), payload);

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

    expect(EXTENDED_SUCCESS_STATUSES).toContain(result.response.status());
    const body = await result.response.json().catch(() => null);
    if ([200, 201].includes(result.response.status())) {
      expect(body).toBeTruthy();
    }

    const success = analyzeCreateUserSuccess(result);

    reporter.reportPass(
      success.description,
      success.category
    );
  });
});
