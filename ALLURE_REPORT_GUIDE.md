# Allure Report Guide

Complete instructions for viewing and understanding the Allure test report, including mobile test results and fixes.

## Quick Start

```bash
# Automatic: Generate and open report
npm run allure:report
npm run allure:open
```

Browser will open automatically at `http://localhost:7070`

---

## Manual Setup (For Downloaded Reports)

### Option 1: Python HTTP Server (Recommended)

```bash
# Navigate to report directory
cd /Users/minime/Downloads/allure-report-2

# Start server on port 8000
python3 -m http.server 8000
```

Then open: **http://localhost:8000**

### Option 2: Node.js HTTP Server

```bash
# From report directory
cd /Users/minime/Downloads/allure-report-2

# Install if needed
npm install -g serve

# Start server
serve -p 8000 -s .
```

Then open: **http://localhost:8000**

### Option 3: NPX (No Installation)

```bash
# From report directory
cd /Users/minime/Downloads/allure-report-2

# Start server with npx
npx serve -p 8000 -s .
```

Then open: **http://localhost:8000**

---

## Using Different Ports

If port 8000 is already in use:

```bash
# Use port 9000
python3 -m http.server 9000
# Visit http://localhost:9000

# Or port 3000
npx serve -p 3000 -s .
# Visit http://localhost:3000
```

---

## Report Sections

### Overview Dashboard
- **Total Tests:** 959
- **Passed:** 886 (92.4%)
- **Failed:** 8 (0.8% - environment issues)
- **Skipped:** 65 (6.8% - browser-specific)
- **Mobile Tests:** 341 (100% passing)

### Mobile Test Results
Click **Suites** to see:
- **Mobile Chrome Tests:** 170+ ✅ ALL PASSING
- **Mobile Safari Tests:** 171+ ✅ ALL PASSING
- **Average Duration:** 1.2-1.5 seconds per test

### Fixed Mobile Issues
Navigate to **Suites** → **Dashboard** to verify:

1. **should allow logout**
   - Chrome: 664ms ✅
   - Safari: 2.3s ✅
   - Fixed: Side panel navigation timeout

2. **should render profile section when navigating**
   - Both: 1.5s ✅
   - Fixed: Navigation link click timeout

3. **Money transfer flow › should send money successfully**
   - Safari: 1.9s ✅
   - Chrome: 4.7s ✅
   - Fixed: Transfer navigation timeout

4. **UI - Stored XSS › a script-bearing transfer description...**
   - Safari: 1.9s ✅
   - Chrome: 4.8s ✅
   - Fixed: XSS test navigation timeout

### Behaviors (Categories)
Click to explore:
- **OWASP API Security:** Categorized findings
- **Test Layers:** UI, API, Security
- **Epic Organization:** Feature-based grouping

### Security Findings
Detailed breakdown of:
- Critical vulnerabilities (intentional)
- API misconfigurations
- Authentication bypass vectors
- CORS and CSRF issues

### Duration Analysis
Performance metrics:
- **Fastest Test:** 0ms (API checks)
- **Slowest Test:** 32.8 seconds
- **Average:** 737ms
- **Mobile Average:** 1.2-1.5s

### Timeline
Visual representation of:
- Test execution order
- Parallel execution patterns
- Duration distribution
- Failure timeline

### History Trends
Track improvements over time:
- Pass rate trend
- Flakiness metrics
- Performance variance
- Success rate progression

---

## Attachments & Evidence

The report includes 2,999 attachments:
- **Screenshots:** Test failure evidence
- **Traces:** Playwright execution traces with full interaction logs
- **Logs:** Detailed console and network logs
- **Error Context:** Failure analysis and stack traces

### View Attachment in Report
1. Click on any failed test
2. Scroll to "Attachments" section
3. Click screenshot or trace link
4. View evidence of test execution

---

## Understanding Mobile Test Fixes

### The Problem (Before Fixes)
Mobile side panel was hidden off-screen by default:
```css
.side-panel {
  transform: translateX(-100%);
}
```

Navigation links were inside the hidden panel, causing timeouts when tests tried to click them.

### The Solution (After Fixes)
Mobile-aware navigation helper:
1. Detects mobile via menu toggle visibility
2. Clicks menu toggle to open side panel
3. Scrolls link into view within side panel
4. Waits for animations to complete
5. Executes the click

### Verification in Report
All 341 mobile tests now pass with evidence:
- ✅ Execution traces showing proper navigation flow
- ✅ Screenshots of mobile interface with side panel open
- ✅ Performance metrics showing 1.2-1.5s execution
- ✅ No timeouts or errors

---

## Stopping the Server

### Stop Python Server
```bash
# Press Ctrl+C in the terminal
# Or kill the process
pkill -f "http.server"
```

### Stop Node Server
```bash
# Press Ctrl+C in the terminal
# Or kill the process
pkill -f "serve"
```

### Check if Port is in Use
```bash
# See what's running on port 8000
lsof -i :8000

# See what's running on port 3000
lsof -i :3000
```

---

## Troubleshooting

### "500 Failed to fetch" Errors
This happens when opening via `file://` protocol. Always use a web server:
```bash
# DON'T do this
open /Users/minime/Downloads/allure-report/index.html

# DO this instead
python3 -m http.server 8000
# Then visit http://localhost:8000
```

### Port Already in Use
```bash
# Find what's using the port
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use a different port
python3 -m http.server 9000
```

### Report Not Updating
```bash
# Regenerate the report
npm run allure:generate

# Clear old data
rm -rf allure-report/
rm -rf allure-results/

# Run tests and generate new report
npm test
npm run allure:report
```

### Slow Report Loading
```bash
# The report is 212 MB with 2,999 attachments
# Initial load may take 10-30 seconds
# Use Chrome DevTools to monitor network tab
# Press F12 → Network tab → Reload
```

---

## Report Workflow

### Generate New Report
```bash
# Run all tests
npm test

# Generate Allure report from test results
npm run allure:generate

# View the report
npm run allure:open
```

### Update Existing Report
```bash
# Regenerate without re-running tests
npm run allure:generate

# Just open the existing report
npm run allure:open
```

### Clear All Report Data
```bash
# Delete results and report
rm -rf allure-results/
rm -rf allure-report/

# Re-run tests to generate new report
npm test
npm run allure:generate
```

---

## Report Size & Performance

**Report Statistics:**
- Total Size: 212 MB
- Test Cases: 975
- Attachments: 2,999
- Data Files: 3,842
- Execution Time: 21.5 minutes

**Optimizations:**
- Lazy-load attachments
- Compress traces
- Paginate large lists
- Use local server for best performance

---

## Continuous Integration

### GitHub Actions
The CI pipeline automatically:
1. Runs all tests (959 tests)
2. Generates Allure report
3. Uploads as artifact
4. Links to workflow run

Check `.github/workflows/playwright.yml` for details.

### Download from CI
```bash
# After tests pass, download the artifact
# allure-report-*.zip from GitHub Actions
# Unzip and serve locally as shown above
```

---

## Mobile Test Evidence

### What to Look For
In the Allure report, verify these mobile fixes:

1. **No Timeouts on Mobile**
   - Check Suite logs for 30s timeout errors
   - Should see none on Mobile Chrome/Safari

2. **Side Panel Handling**
   - Screenshots show side panel opening on mobile
   - Navigation links visible before clicks
   - All interactions complete successfully

3. **Performance on Mobile**
   - Mobile tests run in 1-5 seconds
   - No test takes >30 seconds
   - Average 1.2-1.5 seconds per mobile test

4. **Consistent Results**
   - Same tests pass on both Chrome and Safari
   - No flakiness specific to mobile
   - 100% pass rate sustained

---

## Questions?

For more details:
- **Framework:** See [TESTING_FRAMEWORK.md](TESTING_FRAMEWORK.md)
- **Mobile Testing:** See [CLAUDE.md](CLAUDE.md) - Mobile Testing section
- **Commands:** See [README.md](README.md) - Quick Start
- **Directory:** See [DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md)

---

**Generated:** 2026-08-02
**Status:** Complete & Verified ✅
