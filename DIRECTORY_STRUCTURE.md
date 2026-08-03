# Project Directory Structure

Complete guide to the testing framework project organization.

##  Root Directory

```
ui_api_bank/
  README.md                       # Main project documentation
  TESTING_FRAMEWORK.md            # Complete framework overview (START HERE)
  QUICK_START.md                  # 5-minute setup guide
  DIRECTORY_STRUCTURE.md          # This file
  CLAUDE.md                       # Project conventions and guidelines

  playwright.config.ts            # Playwright configuration
  global-setup.ts                 # Global test setup (auth caching)
  global-teardown.ts              # Global test teardown (cleanup)
  package.json                    # Dependencies and scripts
  tsconfig.json                   # TypeScript configuration

  helpers/                        # Reusable helper utilities
  fixtures/                       # Test fixtures and setup
  pages/                          # Page objects
  tests/                          # Test specifications
  reporters/                      # Custom test reporters
  scripts/                        # Utility scripts

  Documentation/
    OBSERVABILITY.md               # Phase 2: Tracing & Logging
    RELIABILITY.md                 # Phase 3: Waiting & Isolation
    ADVANCED_INTEGRATION.md        # Phase 4: State Machines
    PHASE2_IMPLEMENTATION.md       # Phase 2: Technical Details
    PHASE3_IMPLEMENTATION.md       # Phase 3: Technical Details
    PHASE4_IMPLEMENTATION.md       # Phase 4: Technical Details
    ADMIN_PANEL_TESTS.md           # Admin panel test guide
    ASSERTION_PATTERNS.md          # Enhanced assertion patterns
    CROSS_BROWSER_TESTING.md       # Browser compatibility
    TESTPLAN.md                    # Test plan and coverage

  .gitignore                      # Git ignore rules
```

##  Core Directories

### `helpers/` - Reusable Utilities

Shared helper functions and utilities used across all tests.

```
helpers/
 logger.ts                          # Structured logging (Phase 2)
   - createLogger(testInfo)
   - logger.info/debug/warn/error()
   - Automatic test attachment

 observability.ts                   # Performance metrics (Phase 2)
   - setupObservability(page, testInfo, logger)
   - logPageLoad(), logPageState()
   - capturePageMetrics()
   - createObservabilityReport()

 wait-helpers.ts                    # Intelligent waits (Phase 3)
   - WaitHelper.waitForNavigation()
   - WaitHelper.waitForElement()
   - WaitHelper.waitForCondition()
   - WaitHelper.waitForNetworkIdle()
   - WaitHelper.retry()
   - WaitHelper.timeouts (QUICK, NORMAL, EXTENDED, NETWORK)

 test-isolation.ts                  # Environment isolation (Phase 3)
   - TestIsolation.setupIsolation()
   - TestIsolation.teardownIsolation()
   - isolateLocalStorage(), isolateSessionStorage()
   - resetNetworkState()

 flakiness-analyzer.ts              # Reliability tracking (Phase 3)
   - FlakinessAnalyzer.recordTestRun()
   - analyzeFlakiness()
   - generateReport()
   - Flakiness scoring and analysis

 state-machine.ts                   # State machines (Phase 4)
   - StateMachine (core implementation)
   - StateMachineBuilder (fluent API)
   - State lifecycle hooks, guards, actions
   - Context data and history

 state-verification.ts              # State verification (Phase 4)
   - StateVerifier (validation framework)
   - verifyState(), verifyTransitionAllowed()
   - verifySequence(), verifyNoErrors()

 scenario-runner.ts                 # Scenario execution (Phase 4)
   - Scenario (individual execution)
   - ConcurrentScenarioRunner (orchestration)
   - ScenarioBuilder (fluent configuration)
   - Concurrent and sequential execution

 common-scenarios.ts                # Pre-built scenarios (Phase 4)
   - CommonScenarios.createLoginScenario()
   - createMoneyTransferScenario()
   - createLoanApplicationScenario()
   - createBillPaymentScenario()
   - And more...

 credentials.ts                     # User credential management
   - User creation and persistence
   - Token caching
   - Test data handling

 schema-validator.ts                # API response validation
   - Schema loading from response-schemas/
   - JSON Schema validation with Ajv
   - Type-safe response checking

 performance-metrics.ts             # Performance tracking
   - Measure operation duration
   - Collect metrics data
   - Performance analysis

 auth-bootstrap.ts                  # Authentication helpers
   - Global auth setup
   - Session management

 expect-logger.ts                   # Assertion logging
   - Log each assertion with actual/expected
   - Track assertion history
   - Detailed assertion debugging

 cross-browser.ts                   # Browser utilities
    - Device emulation
    - Mobile testing helpers
```

### `fixtures/` - Test Fixtures

Custom test fixtures providing pre-configured utilities.

```
fixtures/
 test-context.ts                    # Auto-logging fixture (Phase 2)
   - Pre-configured logger
   - captureFailureContext() helper
   - Auto-attachment of logs

 reliability.ts                     # Reliability fixture (Phase 3)
   - Pre-configured logger
   - waitHelper utility
   - isolateTest() fixture
   - cleanupTest() fixture

 api/
    login.helpers.ts              # Login API helpers
    admin.helpers.ts              # Admin API helpers
    profile.helpers.ts            # Profile API helpers
    dashboard.helpers.ts          # Dashboard API helpers
    transfer.helpers.ts           # Transfer API helpers
    loans.helpers.ts              # Loans API helpers
    bill-payments.helpers.ts      # Bill payments API helpers
    virtual-cards.helpers.ts      # Virtual cards API helpers
    [feature].helpers.ts          # Feature-specific API helpers

 helper/
     security-reporter.ts          # Security assertion framework
       - OWASP vulnerability definitions
       - SecurityReporter class
       - reportVulnerability()
       - Security test reporting
    
     helper-base.page.ts           # Base page object class
        - Common assertions
        - Wait methods
        - Interaction methods
```

### `pages/` - Page Objects

Page Object Model (POM) implementation.

```
pages/
 page-manager.ts                    # Central page registry
   - Singleton pattern for page objects
   - One instance per page
   - Centralized access

 helper-base.page.ts                # Base page class
   - Common functionality
   - Assertion helpers
   - Wait utilities

 login.page.ts                      # Login page object
   - fillEmail(), fillPassword()
   - clickSubmit()
   - waitForLoad()

 dashboard.page.ts                  # Dashboard page object
   - Balance display
   - Transaction history
   - Navigation

 profile.page.ts                    # Profile page object
   - Profile editing
   - Picture upload
   - Settings management

 admin-panel.page.ts                # Admin control panel
   - User management
   - Account creation
   - Transaction approval

 money-transfer.page.ts             # Money transfer page
   - Transfer form
   - Recipient selection
   - Amount validation

 loans.page.ts                      # Loan application page
   - Loan form
   - Application tracking
   - Status updates

 bill-payments.page.ts              # Bill payments page
   - Payee management
   - Payment scheduling
   - History

 virtual-cards.page.ts              # Virtual cards page
   - Card creation
   - Limit management
   - Freeze/unfreeze

 register.page.ts                   # Registration page
   - User registration
   - Form validation
   - Account creation

 [feature].page.ts                  # Feature-specific pages
    - Feature interactions
    - Element selectors
    - Assertion methods
```

### `tests/` - Test Specifications

Test suites organized by type and feature.

```
tests/
 observability.spec.ts              # Phase 2 demo (3 tests)
   - Trace collection
   - Custom logging
   - Failure context capture
   - Performance metrics

 reliability.spec.ts                # Phase 3 demo (10 tests)
   - Wait helpers
   - Retry logic
   - Test isolation
   - Timeout handling
   - Flakiness analysis

 advanced-integration.spec.ts       # Phase 4 demo (7 tests)
   - State machines
   - State verification
   - Concurrent scenarios
   - Scenario execution
   - Report generation

 example.spec.ts                    # Example test
 seed.spec.ts                       # Data seeding test

 api/                               # API test specifications
    login.spec.ts                  # Authentication tests
    profile.spec.ts                # Profile API tests
    dashboard.spec.ts              # Dashboard API tests
    transfer.spec.ts               # Money transfer tests
    loans.spec.ts                  # Loan API tests
    bill-payments.spec.ts          # Bill payments tests
    virtual-cards.spec.ts          # Virtual cards tests
    admin.spec.ts                  # Admin API tests
    ai-chat.spec.ts                # AI chat tests
    create-user.spec.ts            # User creation tests
    xss.spec.ts                    # XSS vulnerability tests

 ui/specs/                          # UI test specifications
    admin-panel.spec.ts            # Admin panel tests (66 tests)
    [feature].spec.ts              # Feature UI tests

 security/                          # Security test specifications
     authentication/
        auth.cookies.spec.ts       # Cookie authentication
        broken-authentication.spec.ts
        bruteforce-lockout.spec.ts
        inspect-cookies.spec.ts
     abuse/
        payload-size.spec.ts       # Payload size limits
        rate-limit.spec.ts         # Rate limiting
        concurrent-requests.spec.ts
     headers/
        cors.spec.ts               # CORS validation
        csrf.spec.ts               # CSRF protection
        security-headers.spec.ts
     [category]/                    # Other security tests
```

### `reporters/` - Custom Reporters

Playwright test reporters.

```
reporters/
 failure-context-reporter.ts        # Failure capture (Phase 2)
   - Captures failure metadata
   - Generates failure-context/ JSON files
   - Summary reporting

 reliability-reporter.ts            # Flakiness tracking (Phase 3)
   - Records test execution results
   - Calculates flakiness scores
   - Generates analytics
   - Console highlighting of issues

 security-summary-reporter.ts       # Security reporting
    - OWASP findings summary
    - Vulnerability counts
    - Risk level aggregation
```

### `scripts/` - Utility Scripts

Helper scripts for common tasks.

```
scripts/
 analyze-reliability.js             # Flakiness analysis CLI
   - Generates flakiness report
   - Identifies critical tests
   - Provides recommendations

 annotate-allure-results.js         # Allure report annotation
    - Adds labels and metadata
    - Organizes by category
    - Generates Allure report
```

##  Output Directories (Gitignored)

These directories are created during test execution and are not committed to git.

```
test-results/                          # Test execution artifacts
 [test-name]/
    trace.zip                      # Execution trace
    video.webm                     # Video recording (on failure)
    test-failed-*.png              # Screenshots (on failure)
    error-context.md               # Error details

playwright-report/                     # HTML test report
 index.html                         # Main report
 data/                              # Report data files
 trace/                             # Embedded traces

allure-results/                        # Allure raw results
 [uuid]-result.json                 # Test result JSON
 [uuid]-attachment.png              # Attachments
 categories.json

allure-report/                         # Generated Allure report
 index.html
 data/
 plugins/

failure-context/                       # Failure metadata (Phase 2)
 [test-name]-*.json                 # Failure details
 failure-summary.json               # Summary

test-analytics/                        # Flakiness data (Phase 3)
 test-runs.jsonl                    # Raw test data
 flakiness-report.md                # Analysis report
 [analysis].json
```

##  Configuration Files

### `playwright.config.ts`
Playwright configuration with all reporters and settings.

**Key Settings:**
- Test timeout: 60 seconds
- Expect timeout: 10 seconds
- Action timeout: 30 seconds
- Navigation timeout: 30 seconds
- Trace collection: Always enabled
- Video recording: On first failure (local), retain on failure (CI)
- Screenshot capture: Only on failure
- All reporters enabled (HTML, Allure, custom)

### `package.json`
NPM scripts and dependencies.

**Key Scripts:**
```json
{
  "scripts": {
    "test": "playwright test",
    "test:reliability": "playwright test tests/reliability.spec.ts",
    "test:mobile:android": "wdio run ./mobile/wdio.android.conf.ts",
    "test:mobile:ios": "wdio run ./mobile/wdio.ios.conf.ts",
    "reliability:analyze": "node scripts/analyze-reliability.js",
    "allure:generate": "allure generate",
    "allure:open": "allure open",
    "allure:report": "npm run allure:generate && npm run allure:open"
  }
}
```

### `global-setup.ts`
Runs before all tests to:
- Authenticate admin user
- Cache auth session to `storage/admin-auth.json`
- Prepare test environment

### `global-teardown.ts`
Runs after all tests to:
- Delete test-created users
- Clean up test data
- Preserve master admin account

##  Documentation Files

Located in project root, organized by phase:

### Main Documentation
- `README.md` - Project overview
- `TESTING_FRAMEWORK.md` - Complete framework guide
- `QUICK_START.md` - 5-minute setup
- `DIRECTORY_STRUCTURE.md` - This file
- `CLAUDE.md` - Project conventions

### Phase-Specific Guides
- `OBSERVABILITY.md` - Phase 2 user guide
- `RELIABILITY.md` - Phase 3 user guide
- `ADVANCED_INTEGRATION.md` - Phase 4 user guide

### Phase Implementation Details
- `PHASE2_IMPLEMENTATION.md` - Observability technical details
- `PHASE3_IMPLEMENTATION.md` - Reliability technical details
- `PHASE4_IMPLEMENTATION.md` - Advanced integration technical details

### Additional Guides
- `ADMIN_PANEL_TESTS.md` - Admin testing guide
- `ASSERTION_PATTERNS.md` - Enhanced assertions
- `CROSS_BROWSER_TESTING.md` - Browser compatibility
- `TESTPLAN.md` - Test coverage and planning

##  Test Execution Flow

```
1. global-setup.ts
   ↓
2. Playwright initializes browsers
   ↓
3. Test file loads
   ↓
4. Each test executes:
   - Fixtures initialize (logger, isolation, etc.)
   - Test steps execute
   - Artifacts collected (traces, videos, screenshots)
   - Reporters capture results
   ↓
5. global-teardown.ts
   ↓
6. Reports generated
   - HTML report
   - Allure report
   - Flakiness analysis
   - Failure context
```

##  File Sizes

Typical test project size:

```
helpers/        ~50 KB
fixtures/       ~30 KB
pages/          ~40 KB
tests/          ~200 KB
reporters/      ~15 KB
scripts/        ~5 KB
Docs/           ~300 KB

Total Code:     ~640 KB
Generated:      ~500+ MB (test results, reports)
```

##  Quick Navigation

**Start Here:**
1. [TESTING_FRAMEWORK.md](TESTING_FRAMEWORK.md) - Overview
2. [QUICK_START.md](QUICK_START.md) - Setup
3. This file - Structure

**By Feature:**
- Logging & Tracing → `helpers/logger.ts`, [OBSERVABILITY.md](OBSERVABILITY.md)
- Waiting & Isolation → `helpers/wait-helpers.ts`, [RELIABILITY.md](RELIABILITY.md)
- State Machines → `helpers/state-machine.ts`, [ADVANCED_INTEGRATION.md](ADVANCED_INTEGRATION.md)
- Page Objects → `pages/`, `fixtures/`

**By Phase:**
- Phase 2 → `helpers/logger.ts`, `helpers/observability.ts`
- Phase 3 → `helpers/wait-helpers.ts`, `helpers/test-isolation.ts`, `helpers/flakiness-analyzer.ts`
- Phase 4 → `helpers/state-machine.ts`, `helpers/scenario-runner.ts`, `helpers/state-verification.ts`

---

This structure provides clear separation of concerns, reusability, and scalability for the entire testing framework.
