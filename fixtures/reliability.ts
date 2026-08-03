import { test as base, Page, BrowserContext, TestInfo } from '@playwright/test';
import { createLogger, TestLogger } from '../helpers/logger';
import { WaitHelper } from '../helpers/wait-helpers';
import { TestIsolation, IsolationConfig } from '../helpers/test-isolation';

interface ReliabilityFixtures {
  logger: TestLogger;
  waitHelper: typeof WaitHelper;
  isolateTest: (config?: IsolationConfig) => Promise<void>;
  cleanupTest: (config?: IsolationConfig) => Promise<void>;
}

export const test = base.extend<ReliabilityFixtures>({
  logger: async ({}, use, testInfo) => {
    const logger = createLogger(testInfo);
    await use(logger);
    logger.attachToTest();
  },

  waitHelper: async ({}, use) => {
    await use(WaitHelper);
  },

  isolateTest: async ({ page, context }, use, testInfo) => {
    const logger = createLogger(testInfo);

    const isolate = async (config?: IsolationConfig) => {
      logger.info('Isolating test environment');
      await TestIsolation.setupIsolation(page, context, testInfo, {
        ...config,
        logger
      });
    };

    await use(isolate);
  },

  cleanupTest: async ({ page, context }, use, testInfo) => {
    const logger = createLogger(testInfo);

    const cleanup = async (config?: IsolationConfig) => {
      logger.info('Cleaning up test environment');
      await TestIsolation.teardownIsolation(page, context, testInfo, {
        ...config,
        logger
      });
    };

    await use(cleanup);
  }
});

export { expect } from '@playwright/test';
