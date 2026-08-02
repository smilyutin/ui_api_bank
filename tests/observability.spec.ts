import { test, expect } from '@playwright/test';
import { createLogger } from '../helpers/logger';
import { setupObservability, createObservabilityReport } from '../helpers/observability';

test.describe('Phase 2: Observability Demo', () => {
  test('should demonstrate trace collection and logging', async ({ page, baseURL }, testInfo) => {
    const logger = createLogger(testInfo);
    const observability = await setupObservability(testInfo, logger);

    logger.info('Test started', { baseURL, projectName: testInfo.project?.name });

    logger.debug('Navigating to app home page');
    await page.goto('/');

    logger.info('Page loaded successfully', { url: page.url() });

    await observability.logPageLoad(page);
    await observability.logPageState(page, 'after-navigation');

    logger.debug('Capturing page metrics');
    const metrics = await observability.capturePageMetrics(page);

    logger.info('Verifying page content');
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    logger.debug('Page title verified', { title: pageTitle });

    const reportContent = createObservabilityReport(logger, metrics);
    try {
      testInfo.attach('observability-report', {
        body: reportContent,
        contentType: 'text/plain'
      });
    } catch (e) {
      logger.warn('Could not attach observability report', { error: String(e) });
    }

    logger.info('Test completed successfully');
  });

  test('should capture failure context on test failure', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test with intentional logging');
    logger.info('Step 1: Navigate to home');
    await page.goto('/');

    logger.info('Step 2: Look for non-existent element');
    try {
      await page.locator('[data-testid="non-existent"]').waitFor({ timeout: 1000 });
      logger.info('Element found (unexpected)');
    } catch (e) {
      logger.warn('Expected element not found', { element: 'data-testid=non-existent' });
    }

    logger.info('Step 3: Verify page title');
    const title = await page.title();
    expect(title).toContain('Bank');
  });

  test('should log API activity and performance', async ({ request, baseURL }, testInfo) => {
    const logger = createLogger(testInfo);

    if (!baseURL) {
      logger.error('baseURL not configured', {}, new Error('baseURL is required'));
      throw new Error('baseURL not configured');
    }

    logger.info('Starting API activity logging');

    try {
      logger.debug('Attempting login endpoint discovery');
      const commonEndpoints = [
        '/api/login',
        '/api/auth/login',
        '/api/v1/login'
      ];

      for (const endpoint of commonEndpoints) {
        logger.debug('Testing endpoint', { endpoint });
        try {
          const response = await request.get(`${baseURL}${endpoint}`, {
            timeout: 2000
          });
          logger.info('Endpoint responded', {
            endpoint,
            status: response.status()
          });
          break;
        } catch (e) {
          logger.debug('Endpoint not found or error', {
            endpoint,
            error: String(e)
          });
        }
      }
    } finally {
      logger.info('API logging complete');
    }
  });
});
