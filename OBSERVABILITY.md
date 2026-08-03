# Phase 2: Observability Guide

This guide covers the observability features enabled in Phase 2, designed to provide better debugging, tracing, and failure context capture.

## Features

### 1. Trace Collection

All tests now automatically collect traces which can be viewed in the Playwright Inspector.

**Configuration:**
- **Local development:** `trace: 'on'` - captures traces for all tests
- **CI:** `trace: 'on'` - captures traces for all tests
- **Video recording:** `video: 'on-first-failure'` (local), `'retain-on-failure'` (CI)
- **Screenshots:** `screenshot: 'only-on-failure'`

**View traces:**
```bash
npx playwright show-report
```

Traces contain:
- Network activity
- Console logs and errors
- DOM snapshots at each step
- User input (clicks, typing, etc.)
- Page state changes

### 2. Custom Logging

The `TestLogger` provides structured logging with multiple severity levels.

**Usage:**

```typescript
import { createLogger } from '../helpers/logger';

test('my test', async ({ page }, testInfo) => {
  const logger = createLogger(testInfo);

  logger.debug('Debug message', { someContext: value });
  logger.info('Info message', { moreContext: value });
  logger.warn('Warning message', { warningContext: value });
  logger.error('Error message', { errorContext: value }, error);

  // Logs are automatically attached to test results
});
```

**Log levels:**
- `DEBUG`: Verbose diagnostic information
- `INFO`: General informational messages
- `WARN`: Warning messages for unexpected conditions
- `ERROR`: Error messages with stack traces

**Viewing logs:**
Logs are automatically attached to test results in the HTML report. Each test includes a `test-logs` attachment with:
- Timestamp for each entry
- Context data (JSON)
- Error information if applicable
- Summary statistics (total, by level)

### 3. Observability Helpers

The `setupObservability()` function provides utilities for capturing performance and state information.

**Usage:**

```typescript
import { setupObservability } from '../helpers/observability';

test('my test', async ({ page }, testInfo) => {
  const logger = createLogger(testInfo);
  const observability = await setupObservability(testInfo, logger);

  await page.goto('/');

  // Log page load metrics
  await observability.logPageLoad(page);

  // Log page state
  await observability.logPageState(page, 'after-login');

  // Log network activity
  await observability.logNetworkActivity(page);

  // Capture detailed metrics
  const metrics = await observability.capturePageMetrics(page);
});
```

**Available methods:**
- `logPageLoad()` - Logs DOM content loaded, load complete, and DOM interactive timings
- `logPageState()` - Logs current URL, title, element count
- `logNetworkActivity()` - Logs request count and HTTP status summary
- `capturePageMetrics()` - Returns navigation and resource timing data

### 4. Failure Context Capture

Failures are automatically captured with contextual information.

**Captured data:**
- Test name, status, and error message
- Duration and retry count
- Browser name and project
- File location and line number
- Attached artifacts (screenshots, traces, videos)

**Output:**
Failure context is saved to `failure-context/` directory:
- Individual JSON files for each failed test
- `failure-summary.json` with aggregate data

**Viewing failure context:**
```bash
cat failure-context/failure-summary.json
```

### 5. Integrated Test Context Fixture

For new tests, use the `test` export from `fixtures/test-context.ts` for automatic logging integration.

**Usage:**

```typescript
import { test, expect } from '../fixtures/test-context';

test('my test', async ({ page, logger, captureFailureContext }, testInfo) => {
  logger.info('Test starting');

  await page.goto('/');

  logger.info('Page loaded');

  // On failure, context is automatically captured
});
```

**Fixtures provided:**
- `logger` - Pre-configured TestLogger instance
- `captureFailureContext` - Function to manually capture failure context

## Examples

### Example 1: Login Test with Logging

```typescript
import { test, expect } from '@playwright/test';
import { createLogger } from '../helpers/logger';

test('should log successful login', async ({ page }, testInfo) => {
  const logger = createLogger(testInfo);

  logger.info('Starting login test');

  await page.goto('/login');
  logger.debug('Navigated to login page');

  await page.fill('input[name="username"]', 'testuser');
  logger.debug('Entered username');

  await page.fill('input[name="password"]', 'password123');
  logger.debug('Entered password');

  await page.click('button[type="submit"]');
  logger.info('Submitted login form');

  await page.waitForNavigation();
  logger.info('Login successful', { url: page.url() });

  expect(page.url()).not.toContain('/login');
});
```

### Example 2: Performance Monitoring

```typescript
import { test, expect } from '@playwright/test';
import { createLogger } from '../helpers/logger';
import { setupObservability, createObservabilityReport } from '../helpers/observability';

test('should monitor page performance', async ({ page }, testInfo) => {
  const logger = createLogger(testInfo);
  const observability = await setupObservability(testInfo, logger);

  await page.goto('/dashboard');
  await observability.logPageLoad(page);

  const metrics = await observability.capturePageMetrics(page);
  logger.info('Page metrics captured', metrics);

  const report = createObservabilityReport(logger, metrics);
  testInfo.attach('performance-report', {
    body: report,
    contentType: 'text/plain'
  });

  // Assert on performance thresholds
  if (metrics.navigationTiming) {
    expect(metrics.navigationTiming.loadComplete).toBeLessThan(3000);
  }
});
```

## Trace Viewer

The Playwright Trace Viewer allows you to step through your test execution interactively.

**Features:**
- Step backward/forward through the test
- Inspect page state at each step
- View console logs and network requests
- Time-travel debugging with snapshots

**View a specific trace:**
```bash
npx playwright show-trace test-results/path-to-trace.zip
```

## CI Integration

In CI environments:
- Traces are collected for all tests (not just failures)
- Videos are retained only on failure to save storage
- Failure context JSON is generated for each failed test
- All artifacts are available in the test report

## Troubleshooting

**Traces not appearing in report:**
- Ensure `trace: 'on'` is set in playwright.config.ts
- Check that tests complete without crashing
- Verify traces are being written to `.playwright/trace/`

**Large trace files:**
- Traces can be 10-50MB per test
- Use `trace: 'on-first-failure'` if storage is limited
- Archive traces after test runs

**Missing logs in report:**
- Call `logger.attachToTest()` at end of test (automatic with fixture)
- Ensure `testInfo` is passed to `createLogger()`
- Check for exceptions during test execution

## Configuration

### Enable/Disable Features

**In playwright.config.ts:**
```typescript
use: {
  trace: 'on',              // Always collect traces
  video: 'on-first-failure', // Record video only on first failure
  screenshot: 'only-on-failure', // Capture screenshot only on failure
}
```

### Custom Trace Output

```typescript
use: {
  trace: {
    mode: 'on',
    snapshots: true,
    screenshots: true,
    sources: true
  }
}
```

## Next Steps

- **Phase 1 (Done):** Basic test structure
- **Phase 2 (Done):** Observability with traces, logging, failure context
- **Phase 3:** Multi-browser testing support
- **Phase 4:** Advanced assertion patterns
- **Phase 5:** Scenario-based testing
- **Phase 6:** Cross-browser concurrency

For browser setup in Phase 3, see CROSS_BROWSER_TESTING.md
