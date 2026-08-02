# Cross-Browser Testing Guide (Phase 6)

## Overview

The test suite now supports comprehensive cross-browser testing across all major browser engines:
- **Chromium** (Chrome, Edge, Opera)
- **Firefox**
- **WebKit** (Safari)
- **Mobile Chrome** (Pixel 5 emulation)
- **Mobile Safari** (iPhone 12 emulation)

All tests are automatically executed across all browsers via the `playwright.config.ts` project matrix.

## Installation

Browsers are installed as part of Playwright setup:

```bash
# Install/update all browsers (Chromium, Firefox, WebKit)
npx playwright install

# Install specific browser
npx playwright install firefox webkit
```

## Running Cross-Browser Tests

### Run all tests on all browsers (CI mode)
```bash
BASE_URL=http://localhost:5001 npm test
```

### Run specific browser
```bash
# Chromium only
npx playwright test --project=chromium

# Firefox only
npx playwright test --project=firefox

# WebKit (Safari) only
npx playwright test --project=webkit

# Mobile Chrome
npx playwright test --project="Mobile Chrome"

# Mobile Safari
npx playwright test --project="Mobile Safari"
```

### Run parallel on all desktop browsers
```bash
npx playwright test --project=chromium --project=firefox --project=webkit
```

### Run specific test file across browsers
```bash
npx playwright test tests/ui/specs/login-cross-browser.spec.ts
```

### Run with grep pattern
```bash
# Run all cross-browser tests
npx playwright test -g "Cross-Browser"

# Run login tests on Firefox only
npx playwright test -g "Login" --project=firefox
```

## Cross-Browser Helper

The `CrossBrowserHelper` class (in `helpers/cross-browser.ts`) provides utilities for handling browser-specific behavior:

### Usage in Tests

```typescript
import { CrossBrowserHelper } from '../../../helpers/cross-browser';

test('should work on all browsers', async ({ page, browserName }) => {
  const cbh = new CrossBrowserHelper(page, browserName as any);

  // Skip test on specific browser
  if (cbh.shouldSkipOn('webkit')) {
    test.skip();
  }

  // Check browser capabilities
  const caps = cbh.getCapabilities();
  if (caps.requiresExplicitWaits) {
    // Firefox/Safari need extra waits
    await page.waitForTimeout(100);
  }

  // Setup auth storage (handles browser differences)
  await cbh.setupAuthStorage(token, 'auto');

  // Verify focus outline (browser-specific widths)
  await cbh.verifyFocusOutline('input[name="username"]');

  // Get storage contents (debugging)
  const storage = await cbh.getStorageContents();

  // Clear all storage (test isolation)
  await cbh.clearAllStorage();

  // Browser-specific key press handling
  await cbh.pressKey('Tab');

  // Browser-specific screenshot
  await cbh.takeScreenshot('login-form');
});
```

### Available Methods

| Method | Purpose |
|--------|---------|
| `getCapabilities()` | Get browser capabilities & quirks |
| `shouldSkipOn(name)` | Check if should skip on browser(s) |
| `isBrowser(name)` | Check current browser |
| `setupAuthStorage(token)` | Setup auth (handles browser differences) |
| `waitForElement(selector)` | Wait with browser-specific timeouts |
| `verifyFocusOutline(selector)` | Verify focus indicator visible |
| `getStorageContents()` | Get localStorage/sessionStorage/cookies |
| `clearAllStorage()` | Clear all storage for isolation |
| `pressKey(key)` | Browser-aware key press |
| `takeScreenshot(name)` | Browser-aware screenshot |

## Browser Capabilities & Quirks

### Chromium
 Full support for localStorage, sessionStorage, cookies
 No explicit waits needed for most operations
 Standard focus outline width (2px)
 Consistent timing for async operations

### Firefox
 Full support for localStorage, sessionStorage, cookies
 Requires explicit waits after certain interactions
 Slightly longer timeout needed for focus handling
 Standard focus outline width (2px)

### WebKit (Safari)
 Full support for localStorage, cookies
 Limited sessionStorage support
 Requires explicit waits for focus operations
 Different focus outline width (1px)
 Known quirks with certain CSS properties

### Mobile Chrome (Pixel 5)
 All Chromium features
 Touch-optimized (44x44px minimum touch targets)
 Responsive viewport (375x812)

### Mobile Safari (iPhone 12)
 All WebKit quirks apply
 Touch-optimized
 Responsive viewport (390x844)

## Common Browser-Specific Issues & Workarounds

### Issue: Tests timing out on Firefox
**Cause:** Firefox needs explicit waits for focus and certain DOM operations
**Solution:**
```typescript
const cbh = new CrossBrowserHelper(page, 'firefox');
if (cbh.shouldSkipOn('firefox')) {
  // Add extra wait for Firefox
  await page.waitForTimeout(100);
}
```

### Issue: Focus outline not visible on Safari
**Cause:** Safari has narrower focus outline (1px vs 2px)
**Solution:**
```typescript
const caps = cbh.getCapabilities();
expect(outlineWidth).toBeGreaterThanOrEqual(caps.focusOutlineWidth);
```

### Issue: SessionStorage not working on Safari
**Cause:** Safari has limited sessionStorage support
**Solution:** Use localStorage instead for Safari
```typescript
await cbh.setupAuthStorage(token, 'localStorage');
```

### Issue: Mobile tests running at desktop size
**Cause:** Tests running wrong project
**Solution:** Explicitly specify mobile project
```bash
npx playwright test --project="Mobile Chrome"
```

## Cross-Browser Test Results

All test results are available in:
- **HTML Report:** `playwright-report/index.html`
- **Allure Report:** `allure-report/index.html` (after `npm run allure:report`)

Results organized by:
- Browser (Chromium, Firefox, WebKit, etc.)
- Feature
- Status (passed, failed, skipped)

## CI/CD Integration

In CI environment (GitHub Actions):
```bash
# Runs all tests sequentially on all browsers
# Workers: 1 (to avoid resource exhaustion)
# Retries: 2 (only in CI)
BASE_URL=http://localhost:5001 npm test
```

Results from all browsers are uploaded as artifacts:
- `playwright-report/` — HTML test report
- `allure-report/` — Allure report with trends
- `test-results/` — JSON results per browser

## Writing New Cross-Browser Tests

### Template
```typescript
import { test } from '@playwright/test';
import { CrossBrowserHelper } from '../../../helpers/cross-browser';

test('should work on all browsers', async ({ page, browserName, baseURL }) => {
  if (!baseURL) throw new Error('baseURL is not defined');

  const cbh = new CrossBrowserHelper(page, browserName as any);

  // Skip if browser has known limitation
  if (cbh.shouldSkipOn('webkit')) {
    test.skip();
  }

  // Use cross-browser helpers
  await cbh.clearAllStorage();
  await cbh.setupAuthStorage(token);

  // Your test code here
  // ...

  // Browser-specific assertions can use capabilities
  const caps = cbh.getCapabilities();
  if (caps.requiresExplicitWaits) {
    // Add extra waits for Firefox/Safari
  }
});
```

## Performance Expectations

### Execution Time
- **Single browser:** ~90 seconds (all tests)
- **Parallel (4 workers):** ~30 seconds per browser
- **All 6 browsers (parallel):** ~120 seconds
- **CI (sequential):** ~180 seconds (6 projects × 30s)

### Resource Usage
- **Memory:** ~500MB per browser instance
- **CPU:** 1 core per worker
- **Disk:** ~100MB for traces/videos on failures

## Debugging Cross-Browser Issues

### Enable detailed traces
```bash
# Trace will be saved to test-results/ on failure
TRACE=on npx playwright test --project=firefox
```

### View trace in UI
```bash
npx playwright show-trace test-results/trace.zip
```

### Check video recording
Videos are saved on failure to: `test-results/video.webm`

### Print browser info
```typescript
console.log(`Browser: ${browserName}`);
console.log(`Viewport: ${page.viewportSize()}`);
const caps = cbh.getCapabilities();
console.log(`Capabilities:`, caps);
```

## Known Limitations

| Feature | Chromium | Firefox | WebKit | Mobile Chrome | Mobile Safari |
|---------|----------|---------|--------|---------------|---------------|
| localStorage |  |  |  |  |  |
| sessionStorage |  |  |  |  |  |
| Cookies |  |  |  |  |  |
| Focus handling |  |  |  |  |  |
| Animation timing |  |  |  |  |  |
| Network throttling |  |  |  |  |  |

## Troubleshooting

### "Browser not installed" error
```bash
npx playwright install <browser>
# or
npx playwright install
```

### "timeout: Test timeout of 30000ms exceeded"
- Firefox/WebKit may need longer timeouts
- Add explicit waits using `cbh.waitForElement()`
- Increase timeout in playwright.config.ts for that project

### "Test passed on Chrome but failed on Firefox"
- Check browser capabilities: `cbh.getCapabilities()`
- Add explicit waits: `await page.waitForTimeout(100)`
- Check for async timing issues

### Videos not recording
- Set in playwright.config.ts: `video: 'retain-on-failure'`
- Videos only saved on failure
- Check test-results/ directory

## Best Practices

1. **Always use CrossBrowserHelper** for new tests
2. **Skip gracefully** on known limitations (don't hard-code errors)
3. **Capture browser info** when debugging failures
4. **Use explicit waits**, not hard waits
5. **Test on all 3 desktop browsers** at minimum (Chromium, Firefox, WebKit)
6. **Document browser-specific workarounds** in code comments
7. **Review failures by browser** — cross-browser failures are often browser-specific

## Resources

- [Playwright Browser Support](https://playwright.dev/docs/browsers)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Trace Viewer](https://trace.playwright.dev/)
- [Cross-Browser Test Examples](tests/ui/specs/login-cross-browser.spec.ts)

