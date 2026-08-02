import { test as base, Page, BrowserContext, TestInfo } from '@playwright/test';
import { createLogger, TestLogger } from '../helpers/logger';

interface TestContextFixture {
  logger: TestLogger;
  captureFailureContext: (testInfo: TestInfo, error?: Error) => Promise<void>;
}

export const test = base.extend<TestContextFixture>({
  logger: async ({}, use) => {
    const logger = createLogger();
    await use(logger);
    logger.attachToTest();
  },

  captureFailureContext: async ({}, use) => {
    const captureContext = async (testInfo: TestInfo, error?: Error) => {
      const failureInfo = {
        testName: testInfo.title,
        status: testInfo.status,
        error: error?.message || 'Test failed',
        timestamp: new Date().toISOString(),
        duration: testInfo.duration,
        retries: testInfo.retry,
        browser: testInfo.project?.name,
        file: testInfo.file,
        line: testInfo.line
      };

      try {
        testInfo.attach('failure-context', {
          body: JSON.stringify(failureInfo, null, 2),
          contentType: 'application/json'
        });
      } catch (e) {
        console.error('Failed to attach failure context:', e);
      }
    };

    await use(captureContext);
  }
});

export { expect } from '@playwright/test';
