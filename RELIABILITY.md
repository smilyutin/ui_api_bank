# Phase 3: Reliability Improvements Guide

This guide covers reliability enhancements designed to reduce test flakiness, fix timeout issues, and improve test isolation.

## Overview

Phase 3 implements three key reliability improvements:

1. **Flakiness Analysis** - Identify which tests are failing intermittently
2. **Timeout Management** - Configure appropriate timeouts and use intelligent wait strategies
3. **Test Isolation** - Ensure tests don't interfere with each other

## Features

### 1. Intelligent Wait Helpers

The `WaitHelper` class provides robust waiting strategies for common patterns.

**Available Methods:**

```typescript
import { WaitHelper } from '../helpers/wait-helpers';

// Wait for navigation with timeout
await WaitHelper.waitForNavigation(page, () => page.click('button'), {
  timeout: WaitHelper.timeouts.NORMAL,
  logger
});

// Wait for element visibility
await WaitHelper.waitForElement(page.locator('[role="button"]'), {
  timeout: WaitHelper.timeouts.NORMAL
});

// Wait for condition with polling
await WaitHelper.waitForCondition(
  () => page.title().then(t => t.includes('Dashboard')),
  { timeout: WaitHelper.timeouts.EXTENDED }
);

// Wait for stable DOM (no mutations)
await WaitHelper.waitForStableDOM(page, {
  timeout: WaitHelper.timeouts.QUICK
});

// Wait for network idle
await WaitHelper.waitForNetworkIdle(page, {
  timeout: WaitHelper.timeouts.EXTENDED
});

// Retry with exponential backoff
const result = await WaitHelper.retry(
  () => page.goto('/'),
  {
    maxAttempts: 3,
    delay: 500,
    backoff: true
  }
);

// Enforce timeout on promise
await WaitHelper.withTimeout(somePromise, 5000, 'Custom timeout message');
```

**Timeout Constants:**

```typescript
WaitHelper.timeouts.QUICK      // 3000ms
WaitHelper.timeouts.NORMAL     // 10000ms
WaitHelper.timeouts.EXTENDED   // 30000ms
WaitHelper.timeouts.NETWORK    // 60000ms
```

### 2. Test Isolation Helpers

Ensure each test runs in a clean environment without interference from previous tests.

**Usage:**

```typescript
import { TestIsolation } from '../helpers/test-isolation';
import { createLogger } from '../helpers/logger';

test('isolated test', async ({ page, context }, testInfo) => {
  const logger = createLogger(testInfo);

  // Setup isolation
  await TestIsolation.setupIsolation(page, context, testInfo, {
    clearCookies: true,
    clearStorage: true,
    resetViewport: true,
    logger
  });

  // Run test...

  // Cleanup
  await TestIsolation.teardownIsolation(page, context, testInfo, {
    clearCookies: true,
    clearStorage: true,
    logger
  });
});
```

**Isolation Methods:**

```typescript
// Clear specific storage types
await TestIsolation.isolateLocalStorage(page, logger);
await TestIsolation.isolateSessionStorage(page, logger);
await TestIsolation.isolateIndexedDB(page, logger);
await TestIsolation.isolateAllStorage(page, logger);

// Reset network state
await TestIsolation.resetNetworkState(page, logger);

// Capture isolation state (for debugging)
const state = await TestIsolation.captureIsolationState(page, context, logger);
```

### 3. Timeout Configuration

Global timeout settings in `playwright.config.ts`:

```typescript
export default defineConfig({
  // Test timeout: 60 seconds
  timeout: 60000,

  // Expect timeout: 10 seconds for assertions
  expect: {
    timeout: 10000
  },

  use: {
    // Action timeout: 30 seconds for interactive operations
    actionTimeout: 30000,

    // Navigation timeout: 30 seconds for navigation
    navigationTimeout: 30000,
  }
});
```

### 4. Flakiness Analysis

Automatically track test flakiness and identify problematic tests.

**Features:**
- Records test results (pass/fail/timeout)
- Calculates flakiness score (0-100%)
- Identifies common error patterns
- Provides remediation recommendations
- Tracks performance variance

**Viewing Reports:**

```bash
# Generate flakiness report
npm run reliability:analyze

# View detailed report
cat test-analytics/flakiness-report.md
```

**Report Contents:**
- Critical tests (>50% flaky)
- High-risk tests (20-50% flaky)
- Timeout issues
- Performance variance
- Error patterns
- Recommendations per test

### 5. Reliability Fixture

Use the pre-configured reliability fixture for automatic isolation:

```typescript
import { test, expect } from '../fixtures/reliability';

test('with auto isolation', async ({ 
  page, 
  logger, 
  waitHelper, 
  isolateTest, 
  cleanupTest 
}, testInfo) => {
  // Auto-setup isolation
  await isolateTest({ clearCookies: true, clearStorage: true });

  logger.info('Test running in isolated environment');

  // Auto-cleanup after test
  await cleanupTest();
});
```

## Configuration

### Test Timeout Strategies

**For short operations (API calls, element clicks):**
```typescript
await page.click('button', { timeout: 5000 });
```

**For page navigation:**
```typescript
await page.goto('/', { timeout: 30000 });
```

**For network operations:**
```typescript
await WaitHelper.waitForNetworkIdle(page, {
  timeout: WaitHelper.timeouts.NETWORK
});
```

### Retry Strategy

**For transient failures:**
```typescript
const result = await WaitHelper.retry(
  () => makeAPICall(),
  {
    maxAttempts: 3,
    delay: 500,
    backoff: true,
    logger
  }
);
```

**For database operations:**
```typescript
const data = await WaitHelper.retry(
  () => fetchFromDB(),
  {
    maxAttempts: 5,
    delay: 1000,
    backoff: true
  }
);
```

## Best Practices

### 1. Use Appropriate Wait Strategies

** Don't:**
```typescript
// Hard waits are unreliable
await page.waitForTimeout(2000);
```

** Do:**
```typescript
// Use intelligent waits
await WaitHelper.waitForElement(locator, { timeout: 10000 });
await WaitHelper.waitForCondition(condition, { timeout: 10000 });
```

### 2. Isolate Tests Properly

** Don't:**
```typescript
test('test1', async ({ page }) => {
  // Leaving cookies/storage from previous tests
  await page.goto('/');
});
```

** Do:**
```typescript
test('test1', async ({ page, context }, testInfo) => {
  await TestIsolation.setupIsolation(page, context, testInfo);
  await page.goto('/');
  await TestIsolation.teardownIsolation(page, context, testInfo);
});
```

### 3. Configure Timeouts Based on Context

**Login operations:** 30 seconds (may involve API calls, redirects)
```typescript
timeout: WaitHelper.timeouts.EXTENDED
```

**Element interactions:** 10 seconds (normal operations)
```typescript
timeout: WaitHelper.timeouts.NORMAL
```

**Quick validations:** 3 seconds (assertions, existence checks)
```typescript
timeout: WaitHelper.timeouts.QUICK
```

### 4. Log Test Progress

** Do:**
```typescript
logger.info('Test starting');
logger.debug('Navigating to page');
await page.goto('/');
logger.info('Page loaded successfully', { url: page.url() });
```

Benefits:
- Better debugging with detailed logs
- Easier to identify where failures occur
- Performance metrics built-in

### 5. Handle Network Variability

** Do:**
```typescript
// Wait for network idle after navigation
await page.goto('/');
await WaitHelper.waitForNetworkIdle(page);

// Or use retry for API calls
const response = await WaitHelper.retry(
  () => api.getUser(id),
  { maxAttempts: 3 }
);
```

## Examples

### Example 1: Reliable Login Test

```typescript
import { test, expect } from '@playwright/test';
import { createLogger } from '../helpers/logger';
import { WaitHelper } from '../helpers/wait-helpers';
import { TestIsolation } from '../helpers/test-isolation';

test('should login reliably', async ({ page, context }, testInfo) => {
  const logger = createLogger(testInfo);

  // Setup
  await TestIsolation.setupIsolation(page, context, testInfo, { logger });

  logger.info('Starting login test');

  // Navigate with retry
  await WaitHelper.retry(
    () => page.goto('/login'),
    { maxAttempts: 2, logger }
  );

  logger.debug('Entering credentials');
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'password');

  // Wait for navigation after login
  await WaitHelper.waitForNavigation(
    page,
    () => page.click('button[type="submit"]'),
    { timeout: WaitHelper.timeouts.EXTENDED, logger }
  );

  logger.info('Login successful');

  // Cleanup
  await TestIsolation.teardownIsolation(page, context, testInfo, { logger });
});
```

### Example 2: API Test with Retry

```typescript
test('should fetch data with retry', async ({ request, baseURL }, testInfo) => {
  const logger = createLogger(testInfo);

  const data = await WaitHelper.retry(
    async () => {
      logger.debug('Fetching API data');
      const response = await request.get(`${baseURL}/api/data`);

      if (!response.ok()) {
        throw new Error(`API error: ${response.status()}`);
      }

      return response.json();
    },
    {
      maxAttempts: 3,
      delay: 500,
      backoff: true,
      logger
    }
  );

  expect(data).toBeTruthy();
  logger.info('API data fetched successfully');
});
```

### Example 3: Element Interaction with Timeout

```typescript
test('should click button when visible', async ({ page }, testInfo) => {
  const logger = createLogger(testInfo);

  await page.goto('/');

  const button = page.locator('[data-testid="submit"]');

  const appeared = await WaitHelper.waitForElement(button, {
    timeout: WaitHelper.timeouts.NORMAL,
    logger
  });

  if (appeared) {
    await button.click();
    logger.info('Button clicked');
  }
});
```

## Troubleshooting

### Issue: Tests Timing Out

**Causes:**
- Network slowness
- Application slow response
- Missing wait strategies

**Solutions:**
```typescript
// Increase timeout
await page.goto('/', { timeout: 60000 });

// Use extended timeout constants
timeout: WaitHelper.timeouts.EXTENDED

// Use retry mechanism
await WaitHelper.retry(action, { maxAttempts: 3 });
```

### Issue: Flaky Tests Intermittently Failing

**Causes:**
- Test isolation issues
- Race conditions
- Timing-dependent assertions

**Solutions:**
```typescript
// Implement proper isolation
await TestIsolation.setupIsolation(page, context, testInfo);

// Use condition-based waits instead of hard waits
await WaitHelper.waitForCondition(
  () => element.isVisible(),
  { timeout: 10000 }
);

// Use stable DOM wait
await WaitHelper.waitForStableDOM(page);
```

### Issue: Tests Interfering with Each Other

**Causes:**
- Shared state (cookies, localStorage)
- Database pollution
- Network state leakage

**Solutions:**
```typescript
// Clear all storage between tests
await TestIsolation.isolateAllStorage(page, logger);

// Use separate test data per test
const uniqueEmail = `test${Date.now()}@example.com`;

// Reset cookies
await context.clearCookies();
```

## Performance Metrics

**Target Thresholds:**
- Single test: < 60 seconds
- Average test: 10-20 seconds
- Quick test: < 5 seconds
- API test: < 10 seconds
- Navigation: < 10 seconds
- Element interaction: < 5 seconds

**Monitoring:**
- Review test-analytics/flakiness-report.md after each test run
- Monitor average duration trends
- Flag tests with high variance (stdDev > avg/2)

## Next Steps

After Phase 3 (Reliability Improvements):
- All timeout issues resolved
- Flakiness < 5% for stable tests
- Test isolation fully implemented
- Comprehensive reliability metrics

**Ready for Phase 4:**
- Advanced pattern matching
- State machine testing
- Complex scenario workflows

## Commands

```bash
# Run reliability tests
npm run test:reliability

# Generate flakiness report
npm run reliability:analyze

# View detailed analytics
cat test-analytics/flakiness-report.md

# Run with reliability reporter enabled
npm test
```

## Files

- `helpers/wait-helpers.ts` - Intelligent wait strategies
- `helpers/test-isolation.ts` - Test environment isolation
- `helpers/flakiness-analyzer.ts` - Flakiness tracking and reporting
- `fixtures/reliability.ts` - Pre-configured reliability fixture
- `reporters/reliability-reporter.ts` - Automatic flakiness reporting
- `tests/reliability.spec.ts` - Demonstration tests
