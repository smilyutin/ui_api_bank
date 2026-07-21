---
name: appium-mobile-bank
description: Create or update the Appium/WebdriverIO mobile-web automation suite for the Vulnerable Bank application (real Chrome/Safari mobile browser engines, not Playwright emulation).
---

# Appium Mobile-Web Automation for Vulnerable Bank

This suite drives real mobile browser engines — Chrome on an Android emulator/device (Appium's UiAutomator2 driver), Safari on an iOS simulator/device (XCUITest driver) — against the same Flask app the Playwright suite tests. There is no native Android/iOS app in this repo; "mobile" here means real-engine mobile web, catching bugs (touch events, mobile Safari quirks, viewport-driven CSS bugs) that Playwright's Chromium-only device emulation can't.

This is a separate framework from Playwright (WebdriverIO/Mocha, not `@playwright/test`) because Playwright cannot drive Appium/WebDriver sessions. It mirrors the Playwright suite's conventions wherever the different protocol allows — see `.claude/skills/playwright-vulnerable-bank/SKILL.md` for the sibling suite this one is modeled on.

## Project Layout

```
mobile/
  wdio.conf.ts            Shared base config (spec glob, baseUrl, Allure reporter) - not run directly
  wdio.android.conf.ts    Android/Chrome capabilities + Appium service, extends the base config
  wdio.ios.conf.ts        iOS/Safari capabilities + Appium service, extends the base config
  tsconfig.json           Separate from the repo root tsconfig.json - WebdriverIO's ambient types
                           (mocha globals, expect-webdriverio matchers) would otherwise leak into
                           the Playwright suite's type-checking
  pages/
    mobile-helper-base.ts    Analogous to pages/helper-base.page.ts
    mobile-page-manager.ts   Analogous to pages/page-manager.ts - one instance per page object, accessor methods
    login.page.ts, dashboard.page.ts, money-transfer.page.ts
  fixtures/
    mobile-auth.ts          WebdriverIO port of helpers/auth-bootstrap.ts + helpers/credentials.ts
  specs/
    *.mobile.spec.ts        One spec file per flow
```

Conventions carried over from the Playwright suite, unchanged:
- No barrel/`index.ts` files — import each module directly.
- Locators live inside page-object methods, not constructor fields.
- One manager class (`MobilePageManager`) owns every page object; specs build one manager and never construct a page object directly.
- Reuse `test-data/users.json` via `helpers/credentials.ts` (`findOrCreateUser`, `loadStoredToken`, `saveStoredToken`) — do not create a separate mobile-only user store. That module is pure `fs`/JSON with no Playwright dependency, so it imports cleanly from `mobile/fixtures/mobile-auth.ts`.

## What differs from the Playwright suite

- **No `Page` object to pass around.** WebdriverIO exposes the session through the `browser`/`$`/`$$` globals (imported from `@wdio/globals`), so page objects and fixtures call these directly instead of taking a `page` constructor argument.
- **Auth bootstrap uses `fetch` + `browser.setCookies`/`browser.execute`,** not Playwright's `request.newContext()` + `page.context().addCookies()`. See `mobile/fixtures/mobile-auth.ts`'s `ensureDashboardAuthenticated` — same token-then-credentials fallback strategy as `helpers/auth-bootstrap.ts`, ported.
- **Assertions use `expect-webdriverio`** (`expect(el).toBeDisplayed()`, `expect(browser).toHaveUrl(...)`), not `@playwright/test`'s `expect`.
- **No `networkidle`-equivalent wait** — same rule as the Playwright suite: the dashboard's background fetches never let things settle, so `waitForLoad()` polls for the actual UI (URL + heading + `#balance`) with `browser.waitUntil`/`waitForDisplayed`, never a blanket idle wait.
- **Schema validation and `SecurityReporter` are out of scope here.** Those are Playwright/API-protocol specific (`helpers/schema-validator.ts`, `fixtures/helper/security-reporter.ts`); this suite is UI-only functional/responsive coverage. Don't port them — if API-level or OWASP-tagged coverage is needed, add it to the Playwright suite instead.

## Adding a New Spec

1. Check whether the flow's page object already exists under `mobile/pages/`; if not, add one extending `MobileHelperBase`, using the *same locators* as the Playwright page object for that flow (same DOM, so selectors should match 1:1 — check `pages/<feature>.page.ts` first).
2. Register the new page object in `mobile/pages/mobile-page-manager.ts` (constructor field + accessor method).
3. Add `mobile/specs/<feature>.mobile.spec.ts`. Use `ensureDashboardAuthenticated` from `mobile/fixtures/mobile-auth.ts` in a `beforeEach` for any flow past login, same as the Playwright suite's `ensureDashboardAuthenticated` in `helpers/auth-bootstrap.ts`.
4. Run locally against a booted emulator/simulator (see README.md's "Mobile Testing (Appium)" section for prerequisites) before assuming CI parity — the `mobile-android` CI job is `workflow_dispatch`-only until proven stable, so nothing catches a broken spec automatically on every push yet.

## Running

```bash
npm run test:mobile:android   # requires ANDROID_HOME + a booted AVD with Chrome
npm run test:mobile:ios       # macOS only, requires Xcode + a booted iOS Simulator
```

Both write Allure results into the same `allure-results/` directory the Playwright suite uses, so `npm run allure:generate`/`allure:open` show both suites in one report.
