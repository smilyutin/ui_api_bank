# Vulnerable Bank - Complete Testing Framework

A deliberately vulnerable banking application paired with a **production-ready, 4-phase testing framework** for practicing security testing, secure code review, and implementing security in CI/CD pipelines.

** WARNING:** This application is intentionally vulnerable and should only be used for educational purposes in isolated environments.

##  Framework Highlights

| Phase | Capability | Tests | Status |
|-------|-----------|-------|--------|
| 1 | Foundation & Page Objects | ~50 |  Complete |
| 2 | Observability (Traces, Logs) | 3 |  Complete |
| 3 | Reliability (Waits, Isolation) | 10 |  Complete |
| 4 | Advanced Integration (State Machines) | 7 |  Complete |
| **Total** | **Complete Framework** | **~70** | ** Production Ready** |

---

##  Quick Start (5 Minutes)

### 1. Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### 2. Setup
```bash
# Clone and install
cd ui_api_bank
npm install

# Start application
docker compose up -d --build

# Run all tests
npm test

# View results
npx playwright show-report
```

### 3. Common Commands
```bash
# Run specific phase tests
npm run test:reliability                # Phase 3
npm test -- tests/advanced-integration.spec.ts  # Phase 4

# Analyze flakiness
npm run reliability:analyze

# View Allure report
npm run allure:report
```

**Full Setup:** See [QUICK_START.md](QUICK_START.md)

---

##  Documentation Guide

### Getting Started (Choose Your Path)

**New Users (30 min):**
1. [QUICK_START.md](QUICK_START.md) - Setup and first test
2. [TESTING_FRAMEWORK.md](TESTING_FRAMEWORK.md) - Framework overview
3. Run demo tests and view results

**Learn by Phase (2-3 hours):**
1. [OBSERVABILITY.md](OBSERVABILITY.md) - Phase 2 guide
2. [RELIABILITY.md](RELIABILITY.md) - Phase 3 guide
3. [ADVANCED_INTEGRATION.md](ADVANCED_INTEGRATION.md) - Phase 4 guide

**Deep Dive (4+ hours):**
- All user guides (above)
- Implementation details (PHASE2/3/4_IMPLEMENTATION.md)
- Code exploration in `helpers/`, `fixtures/`, `pages/`

**Find Anything:**
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - Master index
- [DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md) - File organization

---

##  The 4 Phases

### Phase 1: Foundation 
**What:** Basic test infrastructure and conventions

**Includes:**
- Page Object Model with centralized registry
- Test structure and setup/teardown
- Authentication and credential management
- Schema validation for API responses
- Security assertion framework (OWASP Top 10)

**Learn:** [CLAUDE.md](CLAUDE.md)

---

### Phase 2: Observability 
**What:** Complete visibility into test execution

**Features:**
- **Automatic Trace Collection** - Every test captured for replay
- **Structured Logging** - DEBUG/INFO/WARN/ERROR levels with context
- **Failure Context** - Metadata capture on failures
- **Performance Metrics** - Page load, resource timing, network activity
- **Comprehensive Reporting** - HTML with embedded traces

**Key Files:**
```
helpers/logger.ts              # Structured logging
helpers/observability.ts       # Performance metrics
fixtures/test-context.ts       # Auto-logging fixture
reporters/failure-context-reporter.ts  # Failure capture
```

**Demo Tests:** `tests/observability.spec.ts` (3 tests)

**Learn:** [OBSERVABILITY.md](OBSERVABILITY.md)

**Run:**
```bash
npm test -- tests/observability.spec.ts
npx playwright show-report
```

---

### Phase 3: Reliability 
**What:** Robust test execution with intelligent waiting and isolation

**Features:**
- **Smart Wait Helpers** - Navigation, elements, conditions, network
- **Exponential Backoff** - Retry with intelligent delays
- **Test Isolation** - Clean cookies, storage, network state
- **Flakiness Analysis** - Track and analyze test stability
- **Timeout Configuration** - 60s tests, 30s actions, 10s assertions

**Key Files:**
```
helpers/wait-helpers.ts        # Intelligent waiting
helpers/test-isolation.ts      # Environment isolation
helpers/flakiness-analyzer.ts  # Reliability tracking
fixtures/reliability.ts        # Pre-configured fixture
reporters/reliability-reporter.ts  # Flakiness reporting
scripts/analyze-reliability.js # Analysis CLI
```

**Demo Tests:** `tests/reliability.spec.ts` (10 tests)

**Learn:** [RELIABILITY.md](RELIABILITY.md)

**Run:**
```bash
npm run test:reliability
npm run reliability:analyze
cat test-analytics/flakiness-report.md
```

---

### Phase 4: Advanced Integration 
**What:** Sophisticated test orchestration and state machine verification

**Features:**
- **State Machines** - Model complex application flows
- **Transition Verification** - Validate business rules
- **Concurrent Scenarios** - Execute multiple workflows in parallel
- **Pre-built Scenarios** - Common workflows ready to use
- **Comprehensive Reporting** - State transitions and execution details

**Key Files:**
```
helpers/state-machine.ts       # State machine core
helpers/state-verification.ts  # Transition validation
helpers/scenario-runner.ts     # Scenario orchestration
helpers/common-scenarios.ts    # Pre-built workflows
```

**Demo Tests:** `tests/advanced-integration.spec.ts` (7 tests)

**Learn:** [ADVANCED_INTEGRATION.md](ADVANCED_INTEGRATION.md)

**Run:**
```bash
npm test -- tests/advanced-integration.spec.ts
npx playwright show-report
```

---

##  Project Structure

```
ui_api_bank/
  DOCUMENTATION (Start here!)
    QUICK_START.md                 # 5-minute setup
    TESTING_FRAMEWORK.md           # Complete overview
    DOCUMENTATION_INDEX.md         # Master index
    DIRECTORY_STRUCTURE.md         # File layout
    OBSERVABILITY.md               # Phase 2 guide
    RELIABILITY.md                 # Phase 3 guide
    ADVANCED_INTEGRATION.md        # Phase 4 guide

  CONFIGURATION
    playwright.config.ts           # Playwright configuration
    global-setup.ts                # Pre-test setup (auth)
    global-teardown.ts             # Post-test cleanup
    package.json                   # Dependencies & scripts
    tsconfig.json                  # TypeScript config

  HELPERS (9 modules)
    logger.ts                      # Structured logging (Phase 2)
    observability.ts               # Performance metrics (Phase 2)
    wait-helpers.ts                # Smart waits (Phase 3)
    test-isolation.ts              # Isolation framework (Phase 3)
    flakiness-analyzer.ts          # Reliability tracking (Phase 3)
    state-machine.ts               # State machines (Phase 4)
    state-verification.ts          # State verification (Phase 4)
    scenario-runner.ts             # Scenario execution (Phase 4)
    common-scenarios.ts            # Pre-built scenarios (Phase 4)
    credentials.ts                 # User management
    schema-validator.ts            # API validation
    performance-metrics.ts         # Performance tracking
    auth-bootstrap.ts              # Auth helpers
    expect-logger.ts               # Assertion logging
    cross-browser.ts               # Browser utilities

  FIXTURES
    test-context.ts                # Auto-logging fixture (Phase 2)
    reliability.ts                 # Reliability fixture (Phase 3)
    api/                           # API helpers
    helper/
        security-reporter.ts       # Security framework
        helper-base.page.ts        # Base page class

  PAGE OBJECTS
    page-manager.ts                # Central registry
    login.page.ts
    dashboard.page.ts
    profile.page.ts
    admin-panel.page.ts
    money-transfer.page.ts
    loans.page.ts
    bill-payments.page.ts
    virtual-cards.page.ts

  TEST SUITES (~70 tests)
    observability.spec.ts          # Phase 2 (3 tests)
    reliability.spec.ts            # Phase 3 (10 tests)
    advanced-integration.spec.ts   # Phase 4 (7 tests)
    api/                           # API tests (~30 tests)
    ui/specs/                      # UI tests (66 admin tests)
    security/                      # Security tests

  REPORTERS
    failure-context-reporter.ts    # Failure metadata (Phase 2)
    reliability-reporter.ts        # Flakiness tracking (Phase 3)
    security-summary-reporter.ts   # Security summary

  SCRIPTS
    analyze-reliability.js         # Flakiness analysis CLI

  OUTPUT (gitignored)
     test-results/                  # Traces, videos, screenshots
     playwright-report/             # HTML report
     allure-results/ & allure-report/  # Allure analytics
     failure-context/               # Failure metadata
     test-analytics/                # Flakiness data
```

See [DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md) for complete details.

---

##  Running Tests

### All Tests
```bash
npm test
```

### By Phase
```bash
# Phase 2: Observability
npm test -- tests/observability.spec.ts

# Phase 3: Reliability  
npm run test:reliability

# Phase 4: Advanced Integration
npm test -- tests/advanced-integration.spec.ts
```

### By Browser
```bash
npm test -- --project=chromium    # Chrome
npm test -- --project=firefox     # Firefox
npm test -- --project=webkit      # Safari
```

### By Name
```bash
npm test -- -g "should login"
```

### Admin Panel Tests
```bash
npm test -- tests/ui/specs/admin-panel.spec.ts
```

---

##  Viewing Results

### Playwright Report (Traces & Videos)
```bash
npx playwright show-report
```
Shows:
- Test pass/fail status
- Video recordings of failures
- Screenshots on failure
- Full execution traces
- Console logs and network activity

### Allure Report (Analytics & Mobile Test Results)

#### Quick Start (Recommended)
```bash
# Generate and open Allure report automatically
npm run allure:report
npm run allure:open
```

#### Manual Setup (View from Downloaded Report)

If you have a downloaded Allure report or want to view it manually:

**Option 1: Python HTTP Server (Easiest)**
```bash
# Navigate to report directory
cd /Users/minime/Downloads/allure-report-2
# OR for the original report
cd /Users/minime/Downloads/allure-report

# Start server on port 8000
python3 -m http.server 8000

# Open browser: http://localhost:8000
```

**Option 2: Node.js HTTP Server**
```bash
# From report directory
npx serve -p 8000 -s .

# Open browser: http://localhost:8000
```

**Option 3: From Project Root**
```bash
# Navigate to project
cd /Users/minime/Projects/ui_api_bank

# Generate fresh report and serve
npm run allure:generate
npm run allure:open
```

#### Stop the Server
```bash
# Press Ctrl+C in terminal
# Or kill the process
pkill -f "http.server 8000"
```

#### Report Contents
Shows:
- **Overview** - Test statistics (passed, failed, skipped)
- **Mobile Tests** - 100% pass rate (341 tests)
  - Mobile Chrome: 170+ tests ✅
  - Mobile Safari: 171+ tests ✅
- **Behaviors** - OWASP categories and test organization
- **Security Findings** - API security vulnerabilities
- **Test History** - Trend analysis and improvements
- **Severity & Duration** - Performance metrics
- **Attachments** - 2,999 screenshots and traces
- **Timeline** - Execution sequence and performance

#### Mobile Viewport Fixes Verified in Report
The Allure report documents all mobile navigation fixes:
- ✅ Dashboard logout (664ms Chrome, 2.3s Safari)
- ✅ Profile navigation (1.5s both browsers)
- ✅ Money transfer (1.9s-4.7s)
- ✅ XSS security tests (1.9s-4.8s)

### Flakiness Analysis
```bash
npm run reliability:analyze
```
Shows:
- Flakiness score per test
- Performance variance
- Error patterns
- Remediation recommendations

### Console Summary
```bash
npm test
# Prints table of security findings directly to console
```

---

##  Security Testing

The framework includes comprehensive security testing:

**OWASP API Top 10 Coverage:**
- API1: Broken Object Level Authorization (BOLA)
- API2: Broken Authentication
- API3: Object Property Level Authorization
- API4: Unrestricted Resource Consumption
- API5: Broken Function Level Authorization
- API6: Mass Assignment
- API7: Server-Side Request Forgery (SSRF)
- API8: Security Misconfiguration
- API9: Improper Inventory Management
- API10: Unsafe Consumption of APIs

**Testing Categories:**
- Authentication & authorization
- CORS & CSRF protection
- SQL injection & XSS
- Rate limiting & abuse
- Security headers
- Mass assignment vulnerabilities

**Framework:** [fixtures/helper/security-reporter.ts](fixtures/helper/security-reporter.ts)

**View Results:**
- Allure report: Behaviors → "OWASP API Security Top 10"
- Console output after `npm test`
- Individual test reports with recommendations

---

##  Browser Support

### Desktop
-  Chromium (Chrome/Edge)
-  Firefox
-  WebKit (Safari)

### Mobile (Emulated)
-  Pixel 5 (Android Chrome)
-  iPhone 12 (Mobile Safari)

### Mobile (Real)
-  Android (WebdriverIO/Appium)
-  iOS (WebdriverIO/Appium)

See [CROSS_BROWSER_TESTING.md](CROSS_BROWSER_TESTING.md)

---

##  Key Commands Reference

### Setup & Run
```bash
npm install                       # Install dependencies
docker compose up -d --build      # Start app
npm test                         # Run all tests
docker compose down -v           # Stop app
```

### View Results
```bash
npx playwright show-report       # Traces & videos
npm run allure:report            # Analytics
npm run reliability:analyze      # Flakiness
```

### Debug
```bash
npx playwright test --debug      # Interactive debugger
npx playwright show-trace trace.zip  # View specific trace
cat failure-context/failure-summary.json  # Failure details
```

### Admin Tests
```bash
npm test -- tests/ui/specs/admin-panel.spec.ts
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin123 npx playwright test tests/ui/specs/admin-panel.spec.ts
```

### Mobile Tests
```bash
npm run test:mobile:android
npm run test:mobile:ios
```

### Performance Testing
```bash
k6 run perf/k6/smoke.js
k6 run perf/k6/scenarios/auth.js
```

---

##  Learning Resources

### Quick Learning
- [QUICK_START.md](QUICK_START.md) - 5-minute setup (NEW USERS START HERE)
- [TESTING_FRAMEWORK.md](TESTING_FRAMEWORK.md) - Framework overview
- Demo tests - Run and inspect `tests/*observability|reliability|advanced-integration*`

### Deep Learning
- [OBSERVABILITY.md](OBSERVABILITY.md) - Phase 2 complete guide
- [RELIABILITY.md](RELIABILITY.md) - Phase 3 complete guide
- [ADVANCED_INTEGRATION.md](ADVANCED_INTEGRATION.md) - Phase 4 complete guide
- Implementation details - PHASE2/3/4_IMPLEMENTATION.md files

### Reference
- [DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md) - File organization
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - All docs index
- [CLAUDE.md](CLAUDE.md) - Project conventions
- [ADMIN_PANEL_TESTS.md](ADMIN_PANEL_TESTS.md) - Admin testing guide

### Code Examples
- `helpers/` - Reusable utilities
- `tests/observability.spec.ts` - Phase 2 examples
- `tests/reliability.spec.ts` - Phase 3 examples
- `tests/advanced-integration.spec.ts` - Phase 4 examples

---

##  Common Use Cases

### "I want to write tests"
1. Read: [QUICK_START.md](QUICK_START.md)
2. Study: [TESTING_FRAMEWORK.md](TESTING_FRAMEWORK.md)
3. Reference: [DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md)
4. Explore: Demo tests and helpers

### "My tests are flaky"
1. Run: `npm run reliability:analyze`
2. Read: [RELIABILITY.md](RELIABILITY.md)
3. Implement: Smart waits and isolation
4. Review: `test-analytics/flakiness-report.md`

### "I need to debug a test"
1. Run: `npx playwright test --debug`
2. View: `npx playwright show-report`
3. Check: `failure-context/` for failure metadata

### "I want to test complex workflows"
1. Study: [ADVANCED_INTEGRATION.md](ADVANCED_INTEGRATION.md)
2. Review: `tests/advanced-integration.spec.ts`
3. Build: Using `StateMachineBuilder` and `ScenarioBuilder`

### "I need to improve observability"
1. Read: [OBSERVABILITY.md](OBSERVABILITY.md)
2. Use: `createLogger(testInfo)` in tests
3. View: Traces in HTML report

### "I need CI/CD integration"
1. Copy: `playwright.config.ts` settings
2. Check: `.github/workflows/playwright.yml` for examples
3. Configure: Reporter artifacts in your CI

---

##  Configuration

### Timeouts (playwright.config.ts)
```typescript
timeout: 60000              // Test timeout
expect: { timeout: 10000 }  // Assertion timeout
actionTimeout: 30000        // Interactive operations
navigationTimeout: 30000    // Page navigation
```

### Reporters
- **HTML Report:** `playwright-report/` - Visual results with traces
- **Allure Report:** `allure-report/` - Analytics and OWASP mapping
- **Security Summary:** Console output - Quick vulnerability overview
- **Failure Context:** `failure-context/` - Metadata on failures
- **Reliability:** `test-analytics/` - Flakiness analysis

### Concurrent Execution
- **Desktop browsers:** 3 parallel (configurable)
- **Scenario batches:** Default 3 concurrent
- **CI mode:** 1 worker (single-threaded)
- **Local mode:** Auto (system dependent)

---

##  Features Summary

### Observability (Phase 2)
-  Automatic trace collection
-  Structured logging with context
-  Failure metadata capture
-  Performance metrics
-  Network activity logging

### Reliability (Phase 3)
-  Smart wait helpers (7 types)
-  Exponential backoff retry
-  Test isolation framework
-  Flakiness scoring & analysis
-  Timeout configuration

### Advanced Integration (Phase 4)
-  State machine modeling
-  Transition verification
-  Concurrent scenario execution
-  Pre-built workflow scenarios
-  Comprehensive reporting

### Security
-  OWASP API Top 10 checks
-  Authentication testing
-  Authorization bypass detection
-  SQL injection & XSS testing
-  CORS & CSRF validation

### Multi-Browser
-  Chrome, Firefox, Safari
-  Mobile emulation
-  Real mobile via Appium
-  Cross-browser test suites

---

##  Troubleshooting

### Tests Timing Out
```bash
# Increase timeout temporarily
npm test -- --timeout=120000

# Use extended wait in code
await WaitHelper.waitForElement(locator, {
  timeout: WaitHelper.timeouts.EXTENDED
});
```

### Flaky Tests
```bash
# Analyze flakiness
npm run reliability:analyze

# Implement smart waits and isolation
# See RELIABILITY.md for details
```

### Report Generation Issues
```bash
# Clear old reports and regenerate
rm -rf playwright-report/ allure-results/ allure-report/
npm test
npm run allure:report
```

### Docker Issues
```bash
# Full reset
docker compose down -v
docker compose up -d --build --no-cache

# Check logs
docker compose logs -f
```

---

##  Statistics

### Test Coverage
- **Total Tests:** ~70 across all phases
- **Phase 1:** ~50 tests (foundation)
- **Phase 2:** 3 demo tests (observability)
- **Phase 3:** 10 demo tests (reliability)
- **Phase 4:** 7 demo tests (advanced integration)
- **Admin Panel:** 66 UI tests
- **Security:** 20+ OWASP tests

### Documentation
- **Main Guides:** 4 files (setup & overview)
- **Phase Guides:** 3 files (user guides)
- **Implementation:** 3 files (technical details)
- **References:** 5+ additional guides
- **Total:** 16+ comprehensive documents

### Code Organization
- **Helper Modules:** 9 utilities
- **Page Objects:** 8+ pages
- **Fixtures:** 6+ configurations
- **Reporters:** 3 custom reporters
- **Scripts:** Utility tools

---

##  Learning Path

**Beginner (1-2 hours)**
1. [QUICK_START.md](QUICK_START.md) - Get it running
2. Run demo tests - See it in action
3. [TESTING_FRAMEWORK.md](TESTING_FRAMEWORK.md) - Understand basics

**Intermediate (2-4 hours)**
1. [OBSERVABILITY.md](OBSERVABILITY.md) - Learn Phase 2
2. [RELIABILITY.md](RELIABILITY.md) - Learn Phase 3
3. Write your first test with logging and waits

**Advanced (4+ hours)**
1. [ADVANCED_INTEGRATION.md](ADVANCED_INTEGRATION.md) - Learn Phase 4
2. Study implementation details
3. Explore code in `helpers/` and `tests/`
4. Build advanced scenarios

**Expert (Ongoing)**
1. Customize framework for your needs
2. Build domain-specific helpers
3. Integrate with your CI/CD
4. Extend state machines for complex flows

---

##  Getting Help

### Documentation
- All features documented with examples
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - Find anything
- Code comments and docstrings throughout

### Debugging
- Run with `npx playwright test --debug`
- View traces: `npx playwright show-report`
- Check logs: `failure-context/` and `test-analytics/`
- Console output has security findings

### Common Issues
- See Troubleshooting section (above)
- Check [QUICK_START.md](QUICK_START.md) - Debug section
- Review phase-specific guides for deep issues

---

##  Next Steps

1. **Get Started:** [QUICK_START.md](QUICK_START.md)
2. **Run Tests:** `npm test`
3. **View Results:** `npx playwright show-report`
4. **Choose Your Path:**
   - Learn logging → [OBSERVABILITY.md](OBSERVABILITY.md)
   - Learn waits → [RELIABILITY.md](RELIABILITY.md)
   - Learn state machines → [ADVANCED_INTEGRATION.md](ADVANCED_INTEGRATION.md)
5. **Write Your Test** - Use demo tests as reference

---

##  License

MIT License - See [LICENSE.md](LICENSE.md)

---

##  Summary

This is a **production-ready, comprehensive testing framework** combining:
-  **Phase 1:** Solid foundation with POM and fixtures
-  **Phase 2:** Complete observability with traces and logging
-  **Phase 3:** Robust reliability with smart waits and isolation
-  **Phase 4:** Advanced integration with state machines

**Ready for:** Complex end-to-end testing, multi-user concurrent scenarios, security validation, and comprehensive reporting.

**Start now:** [QUICK_START.md](QUICK_START.md) (5 minutes) → Demo tests → Full framework access

 **Happy Testing!**
