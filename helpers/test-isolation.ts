import { Page, BrowserContext, TestInfo } from '@playwright/test';
import { TestLogger } from './logger';

export interface IsolationConfig {
  clearCookies?: boolean;
  clearStorage?: boolean;
  clearCache?: boolean;
  resetViewport?: boolean;
  logger?: TestLogger;
}

export class TestIsolation {
  static async setupIsolation(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    config: IsolationConfig = {}
  ) {
    const {
      clearCookies = true,
      clearStorage = true,
      clearCache = true,
      resetViewport = true,
      logger
    } = config;

    logger?.info('Setting up test isolation', {
      clearCookies,
      clearStorage,
      clearCache,
      resetViewport
    });

    if (clearCookies) {
      await context.clearCookies();
      logger?.debug('Cleared cookies');
    }

    if (clearStorage) {
      await context.clearCookies();
      logger?.debug('Cleared storage');
    }

    if (resetViewport && page.viewportSize()) {
      await page.setViewportSize({ width: 1280, height: 720 });
      logger?.debug('Reset viewport to default');
    }

    logger?.info('Test isolation setup complete');
  }

  static async teardownIsolation(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    config: IsolationConfig = {}
  ) {
    const { clearCookies = true, clearStorage = true, logger } = config;

    logger?.info('Tearing down test isolation');

    if (clearCookies) {
      await context.clearCookies();
      logger?.debug('Cleared cookies');
    }

    if (clearStorage) {
      await context.clearCookies();
      logger?.debug('Cleared storage');
    }

    logger?.info('Test isolation teardown complete');
  }

  static async isolateLocalStorage(page: Page, logger?: TestLogger) {
    logger?.debug('Clearing localStorage');
    try {
      await page.evaluate(() => {
        localStorage.clear();
      });
      logger?.info('localStorage cleared');
    } catch (e) {
      logger?.warn('Could not clear localStorage', { error: String(e) });
    }
  }

  static async isolateSessionStorage(page: Page, logger?: TestLogger) {
    logger?.debug('Clearing sessionStorage');
    try {
      await page.evaluate(() => {
        sessionStorage.clear();
      });
      logger?.info('sessionStorage cleared');
    } catch (e) {
      logger?.warn('Could not clear sessionStorage', { error: String(e) });
    }
  }

  static async isolateIndexedDB(page: Page, logger?: TestLogger) {
    logger?.debug('Clearing IndexedDB');
    try {
      await page.evaluate(async () => {
        const dbs = await indexedDB.databases?.() || [];
        for (const db of dbs) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      });
      logger?.info('IndexedDB cleared');
    } catch (e) {
      logger?.warn('Could not clear IndexedDB', { error: String(e) });
    }
  }

  static async isolateAllStorage(page: Page, logger?: TestLogger) {
    logger?.info('Clearing all browser storage');
    await Promise.all([
      this.isolateLocalStorage(page, logger),
      this.isolateSessionStorage(page, logger),
      this.isolateIndexedDB(page, logger)
    ]);
    logger?.info('All storage cleared');
  }

  static async resetNetworkState(page: Page, logger?: TestLogger) {
    logger?.debug('Resetting network state');
    try {
      await page.context().clearCookies();
      logger?.info('Network state reset');
    } catch (e) {
      logger?.warn('Could not reset network state', { error: String(e) });
    }
  }

  static async captureIsolationState(
    page: Page,
    context: BrowserContext,
    logger?: TestLogger
  ): Promise<Record<string, any>> {
    logger?.debug('Capturing isolation state');

    const state: Record<string, any> = {};

    try {
      state.cookies = await context.cookies();
      state.localStorage = await page.evaluate(() => JSON.stringify(localStorage));
      state.sessionStorage = await page.evaluate(() => JSON.stringify(sessionStorage));
    } catch (e) {
      logger?.debug('Could not capture full isolation state', { error: String(e) });
    }

    logger?.debug('Isolation state captured', { cookieCount: state.cookies?.length || 0 });
    return state;
  }
}
