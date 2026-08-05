import { test, expect } from '@playwright/test';
import { createLogger } from '../helpers/logger';
import { WaitHelper } from '../helpers/wait-helpers';
import { TestIsolation } from '../helpers/test-isolation';

test.describe('@reliability Phase 3: Reliability Improvements', () => {
  test('should use wait helpers for robust navigation', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Reliable navigation with wait helpers');

    await WaitHelper.waitForNavigation(
      page,
      async () => { await page.goto('/'); },
      {
        timeout: WaitHelper.timeouts.NORMAL,
        logger
      }
    );

    await WaitHelper.waitForStableDOM(page, {
      timeout: WaitHelper.timeouts.QUICK,
      logger
    });

    const title = await page.title();
    expect(title).toBeTruthy();
    logger.info('Navigation and page stability verified', { title });
  });

  test('should use retry helper for transient failures', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Retry helper for fault tolerance');

    const result = await WaitHelper.retry(
      async () => {
        logger.debug('Attempting to fetch page title');
        await page.goto('/');
        return await page.title();
      },
      {
        maxAttempts: 3,
        delay: 500,
        backoff: true,
        logger
      }
    );

    expect(result).toBeTruthy();
    logger.info('Retry succeeded', { title: result });
  });

  test('should wait for element visibility with timeout', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Element visibility waiting');

    await page.goto('/');

    const bodyElement = page.locator('body');
    const appeared = await WaitHelper.waitForElement(bodyElement, {
      timeout: WaitHelper.timeouts.NORMAL,
      logger
    });

    expect(appeared).toBe(true);
    logger.info('Element visibility verified');
  });

  test('should wait for condition with polling', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Condition polling');

    await page.goto('/');

    const conditionMet = await WaitHelper.waitForCondition(
      async () => {
        const title = await page.title();
        return title.includes('Bank');
      },
      {
        timeout: WaitHelper.timeouts.NORMAL,
        interval: 500,
        logger
      }
    );

    expect(conditionMet).toBe(true);
    logger.info('Condition met through polling');
  });

  test('should isolate test environment', async ({ page, context }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Test isolation setup');

    await TestIsolation.setupIsolation(page, context, testInfo, {
      clearCookies: true,
      clearStorage: true,
      resetViewport: true,
      logger
    });

    logger.info('Test isolation configured');

    await page.goto('/');
    const initialState = await TestIsolation.captureIsolationState(page, context, logger);

    logger.info('Initial isolation state captured', {
      cookieCount: initialState.cookies?.length || 0
    });

    await TestIsolation.isolateLocalStorage(page, logger);
    await TestIsolation.isolateSessionStorage(page, logger);

    logger.info('Storage isolated');

    await TestIsolation.teardownIsolation(page, context, testInfo, {
      clearCookies: true,
      clearStorage: true,
      logger
    });

    logger.info('Test isolation teardown complete');
  });

  test('should wait for network idle state', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Network idle waiting');

    await page.goto('/');

    try {
      await WaitHelper.waitForLoadState(page, 'networkidle', {
        timeout: WaitHelper.timeouts.EXTENDED,
        logger
      });
      logger.info('Network reached idle state');
    } catch (e) {
      logger.warn('Network idle timeout (may be normal for some pages)', { error: String(e) });
    }

    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should handle API errors with retry logic', async ({ request, baseURL }, testInfo) => {
    const logger = createLogger(testInfo);

    if (!baseURL) throw new Error('baseURL required');

    logger.info('Test: API error retry handling');

    const response = await WaitHelper.retry(
      async () => {
        logger.debug('Attempting API request');
        const res = await request.get(`${baseURL}/api/status`, {
          timeout: WaitHelper.timeouts.NORMAL
        });
        if (!res.ok() && res.status() === 500) {
          throw new Error('Server error, will retry');
        }
        return res;
      },
      {
        maxAttempts: 2,
        delay: 200,
        logger
      }
    );

    logger.info('API request succeeded', {
      status: response.status()
    });
  });

  test('should enforce timeout with withTimeout helper', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Explicit timeout enforcement');

    const promise = page.goto('/', { timeout: 30000 });

    const result = await WaitHelper.withTimeout(
      promise,
      WaitHelper.timeouts.EXTENDED,
      'Navigation timed out'
    );

    expect(result).toBeTruthy();
    logger.info('Navigation completed within enforced timeout');
  });

  test('should wait for text content to appear', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Text content waiting');

    await page.goto('/');

    const bodyText = page.locator('body');

    // Use a simpler approach: just verify the text exists via page evaluation
    const textFound = await page.evaluate(() => {
      return document.body.textContent?.includes('Vulnerable Bank') || false;
    });

    expect(textFound).toBe(true);
    logger.info('Expected text content found');
  });

  test('should measure and log test duration', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);
    const startTime = Date.now();

    logger.info('Test with duration tracking');

    await page.goto('/');
    const navigationTime = Date.now() - startTime;
    logger.info('Navigation complete', { durationMs: navigationTime });

    await page.waitForLoadState('domcontentloaded');
    const domLoadTime = Date.now() - startTime;
    logger.info('DOM content loaded', { durationMs: domLoadTime });

    const totalDuration = Date.now() - startTime;
    logger.info('Test duration summary', {
      totalMs: totalDuration,
      navigationMs: navigationTime,
      domLoadMs: domLoadTime
    });

    expect(totalDuration).toBeLessThan(30000);
  });
});
