import { Page, Locator } from '@playwright/test';
import { TestLogger } from './logger';

interface WaitOptions {
  timeout?: number;
  interval?: number;
  logger?: TestLogger;
}

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_INTERVAL = 500;

export class WaitHelper {
  static readonly timeouts = {
    QUICK: 3000,
    NORMAL: 10000,
    EXTENDED: 30000,
    NETWORK: 60000
  };

  static async waitForNavigation(
    page: Page,
    action: () => Promise<void>,
    options: WaitOptions = {}
  ) {
    const timeout = options.timeout ?? this.timeouts.EXTENDED;
    const logger = options.logger;

    logger?.debug('Waiting for navigation', { timeout });

    try {
      await Promise.race([
        page.waitForNavigation({ timeout }),
        action()
      ]);
      logger?.info('Navigation completed');
    } catch (e) {
      logger?.warn('Navigation timeout or action failed', { timeout, error: String(e) });
      throw e;
    }
  }

  static async waitForElement(
    locator: Locator,
    options: WaitOptions = {}
  ): Promise<boolean> {
    const timeout = options.timeout ?? this.timeouts.NORMAL;
    const logger = options.logger;

    logger?.debug('Waiting for element', { timeout });

    try {
      await locator.waitFor({ timeout, state: 'visible' });
      logger?.info('Element appeared');
      return true;
    } catch (e) {
      logger?.warn('Element did not appear', { timeout });
      return false;
    }
  }

  static async waitForCondition(
    condition: () => Promise<boolean>,
    options: WaitOptions = {}
  ): Promise<boolean> {
    const timeout = options.timeout ?? this.timeouts.EXTENDED;
    const interval = options.interval ?? DEFAULT_INTERVAL;
    const logger = options.logger;

    const startTime = Date.now();
    let lastError: Error | null = null;

    logger?.debug('Waiting for condition', { timeout, interval });

    while (Date.now() - startTime < timeout) {
      try {
        if (await condition()) {
          logger?.info('Condition met');
          return true;
        }
      } catch (e) {
        lastError = e as Error;
        logger?.debug('Condition check failed', { error: String(e) });
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    logger?.warn('Condition not met within timeout', { timeout, error: lastError?.message });
    return false;
  }

  static async waitForStableDOM(
    page: Page,
    options: WaitOptions = {}
  ): Promise<void> {
    const timeout = options.timeout ?? this.timeouts.NORMAL;
    const logger = options.logger;

    logger?.debug('Waiting for stable DOM', { timeout });

    try {
      await page.evaluate((t) => {
        return new Promise<void>((resolve) => {
          let mutationCount = 0;
          const observer = new MutationObserver(() => {
            mutationCount++;
          });

          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });

          const checkInterval = setInterval(() => {
            if (mutationCount === 0) {
              clearInterval(checkInterval);
              observer.disconnect();
              resolve();
            }
            mutationCount = 0;
          }, 100);

          setTimeout(() => {
            clearInterval(checkInterval);
            observer.disconnect();
            resolve();
          }, t);
        });
      }, timeout);

      logger?.info('DOM is stable');
    } catch (e) {
      logger?.debug('DOM stability check timed out (normal)', { error: String(e) });
    }
  }

  static async waitForNetworkIdle(
    page: Page,
    options: WaitOptions = {}
  ): Promise<void> {
    const timeout = options.timeout ?? this.timeouts.EXTENDED;
    const logger = options.logger;

    logger?.debug('Waiting for network idle', { timeout });

    try {
      await page.waitForLoadState('networkidle', { timeout });
      logger?.info('Network is idle');
    } catch (e) {
      logger?.warn('Network idle timeout', { timeout });
      throw e;
    }
  }

  static async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delay?: number;
      backoff?: boolean;
      logger?: TestLogger;
    } = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts ?? 3;
    const delay = options.delay ?? 500;
    const backoff = options.backoff ?? true;
    const logger = options.logger;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger?.debug(`Retry attempt ${attempt}/${maxAttempts}`);
        return await fn();
      } catch (e) {
        lastError = e as Error;
        logger?.warn(`Attempt ${attempt} failed`, { error: String(e) });

        if (attempt < maxAttempts) {
          const waitTime = backoff ? delay * attempt : delay;
          logger?.debug(`Waiting ${waitTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs)
      )
    ]);
  }

  static async waitForTextContent(
    locator: Locator,
    text: string | RegExp,
    options: WaitOptions = {}
  ): Promise<boolean> {
    const timeout = options.timeout ?? this.timeouts.NORMAL;
    const logger = options.logger;

    logger?.debug('Waiting for text content', { text, timeout });

    try {
      await locator.locator(`:has-text("${text}")`).waitFor({ timeout, state: 'visible' });
      logger?.info('Text content appeared');
      return true;
    } catch (e) {
      logger?.warn('Text content not found', { text, timeout });
      return false;
    }
  }

  static async waitForLoadState(
    page: Page,
    state: 'load' | 'domcontentloaded' | 'networkidle' = 'load',
    options: WaitOptions = {}
  ): Promise<void> {
    const timeout = options.timeout ?? this.timeouts.EXTENDED;
    const logger = options.logger;

    logger?.debug(`Waiting for load state: ${state}`, { timeout });

    try {
      await page.waitForLoadState(state, { timeout });
      logger?.info(`Page reached ${state} state`);
    } catch (e) {
      logger?.warn(`Failed to reach ${state} state`, { timeout });
      throw e;
    }
  }
}
