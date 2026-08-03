# Quick Start Guide

Get the testing framework up and running in 5 minutes.

##  Installation

### 1. Prerequisites
- Node.js 18+ 
- Docker and Docker Compose
- Git

### 2. Clone and Install
```bash
# Navigate to project
cd ui_api_bank

# Install dependencies
npm install
```

### 3. Start Application
```bash
# Start Docker containers (Flask app + Postgres)
docker compose up -d --build

# Wait for app to be ready (~10 seconds)
# Application will be at http://localhost:5001
```

### 4. Run Tests
```bash
# Run all tests (default)
npm test

# This will:
# - Execute all test suites
# - Collect traces for all tests
# - Generate HTML report
# - Display pass/fail summary
```

##  View Results

### Test Report with Traces
```bash
npx playwright show-report
```

Opens the Playwright Inspector showing:
- Test results and status
- Video recordings of failures
- Screenshots on failure
- Full execution traces
- Network activity
- Console logs

### Flakiness Analysis
```bash
npm run reliability:analyze
```

Shows:
- Flaky test identification
- Execution statistics
- Performance variance
- Remediation recommendations

##  Run Specific Tests

```bash
# Single test file
npm test -- tests/api/login.spec.ts

# Test by name pattern
npm test -- -g "should login"

# Specific browser
npm test -- --project=chromium

# Admin panel tests only
npm test -- tests/ui/specs/admin-panel.spec.ts

# Reliability demo tests
npm run test:reliability

# Advanced integration tests
npm test -- tests/advanced-integration.spec.ts
```

##  Core Concepts

### 1. **Logging** (Phase 2)
```typescript
import { createLogger } from '../helpers/logger';

test('my test', async ({ page }, testInfo) => {
  const logger = createLogger(testInfo);
  
  logger.info('Starting test');
  await page.goto('/');
  logger.info('Page loaded');
});
```

### 2. **Smart Waits** (Phase 3)
```typescript
import { WaitHelper } from '../helpers/wait-helpers';

// Instead of: await page.waitForTimeout(2000);
// Use smart waits:
await WaitHelper.waitForElement(locator, { timeout: 10000 });
await WaitHelper.waitForCondition(async () => {
  return await page.isVisible('[role="button"]');
});
```

### 3. **Test Isolation** (Phase 3)
```typescript
import { TestIsolation } from '../helpers/test-isolation';

// Clean environment before test
await TestIsolation.setupIsolation(page, context, testInfo);

// Test code here...

// Cleanup after test
await TestIsolation.teardownIsolation(page, context, testInfo);
```

### 4. **State Machines** (Phase 4)
```typescript
import { StateMachineBuilder } from '../helpers/state-machine';

const sm = new StateMachineBuilder('idle')
  .withState({ name: 'processing' })
  .withTransition({ from: 'idle', to: 'processing', event: 'start' })
  .build();

await sm.initialize();
await sm.handleEvent('start');
expect(sm.getCurrentState()).toBe('processing');
```

##  Demo Tests

Each phase includes demo tests showing all features:

### Phase 2: Observability (3 tests)
```bash
npm test -- tests/observability.spec.ts
```
Demonstrates:
- Trace collection
- Custom logging
- Failure context capture
- Performance metrics

### Phase 3: Reliability (10 tests)
```bash
npm run test:reliability
```
Demonstrates:
- Wait helpers
- Test isolation
- Retry logic
- Timeout enforcement
- Flakiness analysis

### Phase 4: Advanced Integration (7 tests)
```bash
npm test -- tests/advanced-integration.spec.ts
```
Demonstrates:
- State machines
- State verification
- Concurrent scenarios
- Scenario builders
- Report generation

##  Configuration

### Timeout Settings
Edit `playwright.config.ts`:
```typescript
timeout: 60000,              // Per-test timeout
expect: { timeout: 10000 },  // Per-assertion timeout
actionTimeout: 30000,        // Action timeout
navigationTimeout: 30000     // Navigation timeout
```

### Concurrent Scenarios
```typescript
const runner = new ConcurrentScenarioRunner(3); // Max 3 concurrent
```

### Test Selection
```bash
# Run only passing tests
npm test -- --grep "should login"

# Exclude admin tests
npm test -- --grep -v "admin"

# Single project
npm test -- --project=firefox
```

##  Project Structure

```
helpers/              → Shared utilities (logging, waiting, isolation, state machines)
fixtures/             → Test fixtures and setup
pages/                → Page objects
tests/                → Test specifications
reporters/            → Custom test reporters
scripts/              → Utility scripts

TESTING_FRAMEWORK.md  → Complete framework guide (start here!)
OBSERVABILITY.md      → Phase 2 guide
RELIABILITY.md        → Phase 3 guide
ADVANCED_INTEGRATION.md → Phase 4 guide
```

##  Debugging

### Run with Inspector
```bash
npx playwright test --debug
```
- Pause execution
- Step through code
- Inspect page state

### View Failing Test Trace
```bash
npx playwright show-trace test-results/*/trace.zip
```

### Check Logs
```bash
# View failure context
cat failure-context/failure-summary.json

# View flakiness report
cat test-analytics/flakiness-report.md
```

##  Next Steps

1. **Read Full Guide:** [TESTING_FRAMEWORK.md](TESTING_FRAMEWORK.md)
2. **Explore Phases:**
   - Phase 2: [OBSERVABILITY.md](OBSERVABILITY.md)
   - Phase 3: [RELIABILITY.md](RELIABILITY.md)
   - Phase 4: [ADVANCED_INTEGRATION.md](ADVANCED_INTEGRATION.md)
3. **Write Your First Test:**
   ```typescript
   import { test, expect } from '@playwright/test';
   import { createLogger } from '../helpers/logger';
   
   test('my first test', async ({ page }, testInfo) => {
     const logger = createLogger(testInfo);
     
     logger.info('Starting test');
     await page.goto('http://localhost:5001');
     
     const title = await page.title();
     expect(title).toBeTruthy();
     logger.info('Test passed', { title });
   });
   ```

##  Help

### Common Issues

**Tests timing out:**
```bash
# Use extended timeout for slow operations
npm test -- --timeout=120000

# Or use WaitHelper.timeouts.NETWORK (60s)
```

**Need to rebuild app:**
```bash
docker compose down -v
docker compose up -d --build
```

**Clear old test data:**
```bash
rm -rf test-results/ playwright-report/ failure-context/ test-analytics/
npm test  # Re-runs from clean state
```

### Documentation

- Framework overview: [TESTING_FRAMEWORK.md](TESTING_FRAMEWORK.md)
- Project setup: [CLAUDE.md](CLAUDE.md)
- Directory structure: [DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md)

---

##  You're Ready!

Your testing framework is set up with:
-  Observability (Phase 2)
-  Reliability (Phase 3)
-  Advanced Integration (Phase 4)
-  Comprehensive reporting

**Start running tests:** `npm test`

**View results:** `npx playwright show-report`

Happy testing! 
