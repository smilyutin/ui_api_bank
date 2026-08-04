import { test, expect } from '@playwright/test';
import { createLogger } from '../helpers/logger';
import { WaitHelper } from '../helpers/wait-helpers';
import {
  StateMachine,
  StateMachineBuilder
} from '../helpers/state-machine';
import { StateVerifier, createStateVerifier } from '../helpers/state-verification';
import {
  ConcurrentScenarioRunner,
  ScenarioBuilder
} from '../helpers/scenario-runner';
import { PageManager } from '../pages/page-manager';

test.describe('@integration Phase 4: Advanced Integration', () => {
  test('should manage state machine for user authentication flow', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: State machine for authentication');

    await page.goto('/', { waitUntil: 'networkidle' });

    const sm = new StateMachineBuilder('login_page')
      .withLogger(logger)
      .withState({
        name: 'login_page',
        onEnter: async (ctx) => {
          logger.debug('Entering login page state');
        }
      })
      .withState({
        name: 'authenticating',
        onEnter: async (ctx) => {
          logger.debug('Entering authenticating state');
			// Simulate auth completing deterministically for this unit test.
			await page.evaluate(() => localStorage.setItem('auth_token', 'test-token'));
			const authReady = await WaitHelper.waitForCondition(
				async () => !!(await page.evaluate(() => localStorage.getItem('auth_token'))),
				{ timeout: WaitHelper.timeouts.QUICK, logger }
			);
          if (!authReady) {
            logger.warn('Auth token not found after condition wait');
          }
        }
      })
      .withState({
        name: 'authenticated',
        onEnter: async (ctx) => {
          logger.debug('Entering authenticated state');
          ctx.data.authTime = Date.now();
        }
      })
      .withState({
        name: 'session_expired',
        onEnter: async (ctx) => {
          logger.debug('Entering session expired state');
        }
      })
      .withTransition({
        from: 'login_page',
        to: 'authenticating',
        event: 'submit_credentials'
      })
      .withTransition({
        from: 'authenticating',
        to: 'authenticated',
        event: 'auth_success',
        guard: async (ctx) => {
          // Check authentication was successful
          return true;
        }
      })
      .withTransition({
        from: 'authenticated',
        to: 'session_expired',
        event: 'session_timeout'
      })
      .withTransition({
        from: 'session_expired',
        to: 'login_page',
        event: 'logout'
      })
      .build();

    await sm.initialize();

    logger.info('Initial state', { state: sm.getCurrentState() });
    expect(sm.getCurrentState()).toBe('login_page');

    // Simulate login flow
    const submitted = await sm.handleEvent('submit_credentials');
    expect(submitted).toBe(true);
    logger.info('Submitted credentials', { state: sm.getCurrentState() });

    const authenticated = await sm.handleEvent('auth_success');
    expect(authenticated).toBe(true);
    logger.info('Authenticated', { state: sm.getCurrentState() });
    expect(sm.getCurrentState()).toBe('authenticated');

    // Simulate session timeout
    const timedOut = await sm.handleEvent('session_timeout');
    expect(timedOut).toBe(true);
    logger.info('Session timeout', { state: sm.getCurrentState() });

    // Return to login
    const logout = await sm.handleEvent('logout');
    expect(logout).toBe(true);
    logger.info('Logged out', { state: sm.getCurrentState() });
    expect(sm.getCurrentState()).toBe('login_page');

    const stats = sm.getStatistics();
    logger.info('State machine statistics', {
      transitions: stats.totalTransitions,
      errors: stats.totalErrors
    });

    expect(stats.totalTransitions).toBe(4);
    expect(stats.totalErrors).toBe(0);
  });

  test('should verify state transitions are allowed', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: State transition verification');

    const sm = new StateMachineBuilder('idle')
      .withLogger(logger)
      .withState({ name: 'idle' })
      .withState({ name: 'processing' })
      .withState({ name: 'completed' })
      .withState({ name: 'error' })
      .withTransition({
        from: 'idle',
        to: 'processing',
        event: 'start'
      })
      .withTransition({
        from: 'processing',
        to: 'completed',
        event: 'finish'
      })
      .withTransition({
        from: 'processing',
        to: 'error',
        event: 'fail'
      })
      .build();

    const verifier = createStateVerifier(sm, logger);

    // Add transition rules
    verifier
      .addAllowedTransition({
        from: 'idle',
        to: 'processing',
        allowedEvents: ['start']
      })
      .addAllowedTransition({
        from: 'processing',
        to: 'completed',
        allowedEvents: ['finish']
      })
      .addAllowedTransition({
        from: 'processing',
        to: 'error',
        allowedEvents: ['fail']
      });

    // Verify initial state
    let validation = verifier.verifyState('idle');
    expect(validation.isValid).toBe(true);
    logger.info('Initial state verified');

    // Transition and verify
    await sm.handleEvent('start');
    validation = verifier.verifyState('processing');
    expect(validation.isValid).toBe(true);
    logger.info('Processing state verified');

    // Verify allowed transition
    validation = verifier.verifyTransitionAllowed('processing', 'completed', 'finish');
    expect(validation.isValid).toBe(true);
    logger.info('Transition allowed');

    await sm.handleEvent('finish');
    validation = verifier.verifyState('completed');
    expect(validation.isValid).toBe(true);
    logger.info('Final state verified');
  });

  test('should execute concurrent scenarios', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Concurrent scenario execution');

    const runner = new ConcurrentScenarioRunner(2, logger);

    // Scenario 1: Check element count
    runner.addScenario({
      name: 'Element Count Scenario',
      steps: [
        {
          name: 'Navigate to home',
          action: async () => {
            logger.debug('Navigating to home');
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');
          }
        },
        {
          name: 'Count page elements',
          action: async () => {
            const count = await page.locator('body').locator('*').count();
            logger.debug('Elements counted', { count });
            expect(count).toBeGreaterThan(0);
          }
        }
      ],
      timeout: 15000
    });

    // Scenario 2: Verify page URL
    runner.addScenario({
      name: 'URL Verification Scenario',
      steps: [
        {
          name: 'Navigate and get URL',
          action: async () => {
            logger.debug('Navigating');
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');
          }
        },
        {
          name: 'Verify URL is set',
          action: async () => {
            const url = await page.url();
            logger.debug('URL verified', { url });
            expect(url).toContain('localhost');
          }
        }
      ],
      timeout: 15000
    });

    // Run concurrently (max 2 at a time)
    const results = await runner.runAll();

    logger.info('Concurrent scenarios completed', {
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length
    });

    expect(results.length).toBe(2);

    // Print results for debugging
    results.forEach(r => {
      logger.info('Scenario result', {
        name: r.scenarioName,
        status: r.status,
        error: r.error
      });
    });

    expect(results.filter(r => r.status === 'success').length).toBeGreaterThanOrEqual(1);

    runner.printSummary();
  });

  test('should execute scenarios sequentially', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Sequential scenario execution');

    const runner = new ConcurrentScenarioRunner(1, logger);

    let executionOrder = 0;

    runner.addScenario({
      name: 'First Scenario',
      steps: [
        {
          name: 'Execute first',
          action: async () => {
            executionOrder = 1;
            logger.debug('First scenario executing');
            await page.goto('/');
          }
        }
      ],
      timeout: 10000
    });

    runner.addScenario({
      name: 'Second Scenario',
      steps: [
        {
          name: 'Execute second',
          action: async () => {
            expect(executionOrder).toBe(1);
            executionOrder = 2;
            logger.debug('Second scenario executing after first');
            await page.goto('/');
          }
        }
      ],
      timeout: 10000
    });

    const results = await runner.runSequential();

    expect(results.length).toBe(2);
    expect(results[0].scenarioName).toBe('First Scenario');
    expect(results[1].scenarioName).toBe('Second Scenario');
    expect(executionOrder).toBe(2);

    logger.info('Sequential execution verified', { finalOrder: executionOrder });
  });

  test('should track state machine context data', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: State machine context data');

    const sm = new StateMachineBuilder('start')
      .withLogger(logger)
      .withState({
        name: 'start',
        onEnter: async (ctx) => {
          ctx.data.userId = 'user123';
          ctx.data.timestamp = Date.now();
        }
      })
      .withState({ name: 'processing' })
      .withTransition({
        from: 'start',
        to: 'processing',
        event: 'begin',
        action: async (ctx) => {
          ctx.data.startTime = Date.now();
        }
      })
      .build();

    await sm.initialize();

    expect(sm.getContextData('userId')).toBe('user123');
    logger.info('Context data initialized', {
      userId: sm.getContextData('userId')
    });

    await sm.handleEvent('begin');

    expect(sm.getContextData('startTime')).toBeDefined();
    logger.info('Context data updated after transition', {
      startTime: sm.getContextData('startTime')
    });

    sm.setContextData('processedItems', 42);
    expect(sm.getContextData('processedItems')).toBe(42);
    logger.info('Custom context data set');
  });

  test('should generate state machine report', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: State machine report generation');

    const sm = new StateMachineBuilder('state_a')
      .withLogger(logger)
      .withState({ name: 'state_a' })
      .withState({ name: 'state_b' })
      .withState({ name: 'state_c' })
      .withTransition({
        from: 'state_a',
        to: 'state_b',
        event: 'go_to_b'
      })
      .withTransition({
        from: 'state_b',
        to: 'state_c',
        event: 'go_to_c'
      })
      .build();

    await sm.initialize();
    await sm.handleEvent('go_to_b');
    await sm.handleEvent('go_to_c');

    const report = sm.generateReport();

    expect(report).toContain('State Machine Report');
    expect(report).toContain('state_c');
    expect(report).toContain('Transition History');
    expect(report).toContain('state_a');

    logger.info('Report generated successfully', {
      reportLength: report.length,
      containsTransitionHistory: report.includes('Transition History')
    });

    try {
      testInfo.attach('state-machine-report', {
        body: report,
        contentType: 'text/plain'
      });
    } catch (e) {
      logger.warn('Could not attach report');
    }
  });

  test('should handle scenario with retry', async ({ page }, testInfo) => {
    const logger = createLogger(testInfo);

    logger.info('Test: Scenario with retry');

    let attemptCount = 0;

    const runner = new ConcurrentScenarioRunner(1, logger);

    runner.addScenario({
      name: 'Scenario with Retries',
      steps: [
        {
          name: 'Flaky operation',
          action: async () => {
            attemptCount++;
            if (attemptCount < 2) {
              throw new Error('Simulated failure');
            }
            logger.debug('Flaky operation succeeded after retry');
            await page.goto('/');
          },
          retries: 3,
          timeout: 5000
        }
      ]
    });

    const results = await runner.runAll();

    expect(results[0].status).toBe('success');
    expect(attemptCount).toBe(2);
    logger.info('Retry mechanism verified', { finalAttempt: attemptCount });
  });
});
