import { Page, BrowserContext, TestInfo } from '@playwright/test';
import { TestLogger } from './logger';

interface PageMetrics {
  navigationTiming?: {
    domContentLoaded: number;
    loadComplete: number;
    domInteractive: number;
  };
  resourceTiming?: Array<{
    name: string;
    duration: number;
    size?: number;
  }>;
}

interface TestObservability {
  logger: TestLogger;
  logPageLoad: (page: Page) => Promise<void>;
  logNetworkActivity: (page: Page) => Promise<void>;
  logPageState: (page: Page, label: string) => Promise<void>;
  capturePageMetrics: (page: Page) => Promise<PageMetrics>;
}

export async function setupObservability(
  testInfo: TestInfo,
  logger: TestLogger
): Promise<TestObservability> {
  const observability: TestObservability = {
    logger,

    async logPageLoad(page: Page) {
      try {
        const metrics = await page.evaluate(() => {
          const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (!timing) return null;
          return {
            domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
            loadComplete: timing.loadEventEnd - timing.loadEventStart,
            domInteractive: timing.domInteractive - timing.fetchStart
          };
        });

        if (metrics) {
          logger.info('Page load metrics', {
            domContentLoaded: `${metrics.domContentLoaded}ms`,
            loadComplete: `${metrics.loadComplete}ms`,
            domInteractive: `${metrics.domInteractive}ms`
          });
        }
      } catch (e) {
        logger.debug('Could not capture page load metrics', { error: String(e) });
      }
    },

    async logNetworkActivity(page: Page) {
      const requests = await page.context().requests?.() || [];
      if (requests.length === 0) return;

      const networkSummary = {
        totalRequests: requests.length,
        byStatus: {} as Record<string, number>
      };

      // @ts-ignore - playwright internals
      const allRequests = page.context()._requests || [];
      allRequests.forEach((req: any) => {
        const status = req.response?.status || 'pending';
        networkSummary.byStatus[status] = (networkSummary.byStatus[status] || 0) + 1;
      });

      logger.info('Network activity', networkSummary);
    },

    async logPageState(page: Page, label: string) {
      try {
        const pageState = {
          url: page.url(),
          title: await page.title(),
          elementCount: await page.locator('*').count(),
          label
        };
        logger.info('Page state', pageState);
      } catch (e) {
        logger.debug('Could not capture page state', { error: String(e) });
      }
    },

    async capturePageMetrics(page: Page): Promise<PageMetrics> {
      const metrics: PageMetrics = {};

      try {
        metrics.navigationTiming = await page.evaluate(() => {
          const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (!timing) return undefined;
          return {
            domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
            loadComplete: timing.loadEventEnd - timing.loadEventStart,
            domInteractive: timing.domInteractive - timing.fetchStart
          };
        });
      } catch (e) {
        logger.debug('Could not capture navigation timing');
      }

      try {
        metrics.resourceTiming = await page.evaluate(() => {
          return performance
            .getEntriesByType('resource')
            .slice(0, 10)
            .map(entry => ({
              name: entry.name.split('/').pop() || entry.name,
              duration: Math.round((entry as PerformanceResourceTiming).duration),
              size: (entry as PerformanceResourceTiming).transferSize
            }));
        });
      } catch (e) {
        logger.debug('Could not capture resource timing');
      }

      return metrics;
    }
  };

  return observability;
}

export function createObservabilityReport(
  logger: TestLogger,
  metrics?: PageMetrics
): string {
  let report = 'TEST OBSERVABILITY REPORT\n';
  report += '='.repeat(60) + '\n\n';

  const logSummary = logger.getSummary();
  report += 'Log Summary:\n';
  report += `  Total entries: ${logSummary.total}\n`;
  report += `  - Info: ${logSummary.info}\n`;
  report += `  - Warnings: ${logSummary.warn}\n`;
  report += `  - Errors: ${logSummary.error}\n`;
  report += `  - Debug: ${logSummary.debug}\n\n`;

  if (metrics?.navigationTiming) {
    report += 'Navigation Timing:\n';
    report += `  DOM Content Loaded: ${metrics.navigationTiming.domContentLoaded}ms\n`;
    report += `  Load Complete: ${metrics.navigationTiming.loadComplete}ms\n`;
    report += `  DOM Interactive: ${metrics.navigationTiming.domInteractive}ms\n\n`;
  }

  if (metrics?.resourceTiming && metrics.resourceTiming.length > 0) {
    report += 'Top Resources:\n';
    metrics.resourceTiming.forEach((res, idx) => {
      report += `  ${idx + 1}. ${res.name}: ${res.duration}ms`;
      if (res.size) report += ` (${res.size} bytes)`;
      report += '\n';
    });
    report += '\n';
  }

  report += logger.getFormattedLogs();
  return report;
}
