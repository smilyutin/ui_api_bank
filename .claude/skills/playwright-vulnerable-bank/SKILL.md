---
name: playwright-vulnerable-bank
description: Create or update Playwright TypeScript automation tests for the Vulnerable Bank application, including UI, API, page object, fixture, and test-data workflows for one feature at a time.
---
# Playwright Automation Tests for Vulnerable Bank

Create maintainable Playwright automation tests in TypeScript for the Vulnerable Bank application, one feature at a time. This skill is the authoritative reference for test-suite conventions in this repo — `CLAUDE.md` links here rather than duplicating this detail, so if you change a convention, update it here first.

## Project Layout

```
pages/            Page Object Model — locators + actions + verifications, extend HelperBase
  page-manager.ts     PageManager — owns one instance of every page object, exposed via accessor methods
fixtures/
  api/                API request helpers, one <feature>.helpers.ts per tested endpoint group
  helper/
    security-reporter.ts   SecurityReporter — OWASP-tagged pass/fail/warning reporting
helpers/            cross-cutting utilities: auth bootstrap, credential persistence, schema validation, perf metrics
response-schemas/   Ajv/JSON-Schema files, one subdir per feature (e.g. login-schema/, virtual-cards-schema/)
test-data/          persisted fixtures (users.json holds the shared test user + tokens)
tests/
  api/                API-only specs
  ui/specs/           UI specs (Playwright Page Object Model via pages/)
  security/           OWASP-style checks, mirrored layout: <category>/<name>.spec.ts
    <category>/           abuse/, authentication/, authorization/, cors/, crossSiteReqForgery/, headers/, input/, supply-chain/
    sec-objects/<category>/<name>.logic.ts   shared probe logic per category
    utils/              re-exports SecurityReporter + credentials helpers to match this layout (see below)
```

There are no barrel/`index.ts` re-export files in `pages/`, `fixtures/api/`, or `fixtures/helper/`. Every spec imports directly from the specific module it needs (e.g. `from '../../pages/dashboard.page'`). Follow that for new files — don't add a barrel.

`tests/security/utils/security-reporter.ts` and `tests/security/utils/test-users.ts` are the one deliberate exception: they each re-export (`export * from ...`) this repo's canonical `fixtures/helper/security-reporter.ts` and `helpers/credentials.ts` respectively, purely so `tests/security/` specs can `import` from a local `../utils/...` path matching this suite's mirrored-layout convention, without duplicating the underlying logic. Import from these `utils/` re-exports when writing a new `tests/security/**/*.spec.ts` file; import directly from `fixtures/helper/security-reporter.ts` / `helpers/credentials.ts` everywhere else (`tests/api/`, `tests/ui/specs/`).

Never add a `.spec.ts` file directly under `tests/` — every spec belongs in `tests/api/`, `tests/ui/specs/`, or a `tests/security/<category>/` subdirectory. `playwright.config.ts`'s `testDir: './tests'` means a loose file at the root still runs on every project silently; `tests/example.spec.ts` (a leftover Playwright-starter smoke test) sat there undetected until an audit caught it and it was relocated to `tests/ui/specs/home-page.spec.ts`. If you're adding a general smoke check that isn't feature-specific, it still goes in `tests/ui/specs/` or `tests/api/` based on what it exercises.

## Test Design

- Make each test cover one business function.
- Keep tests independent and runnable alone or in parallel.
- Use Arrange, Act, Assert structure.
- Prepare data through helpers or APIs when possible.
- Verify the user-visible result and any relevant API or data-state result.
- Avoid test dependencies on execution order.
- Cover both valid and invalid scenarios for each business function: the expected success path and the rejected/error paths (missing or malformed fields, missing or insufficient auth, boundary and edge-case values).
- Validate input constraints explicitly — required fields, type and format, and numeric bounds (zero, negative, and unreasonably large amounts) — instead of only exercising the happy path.
- Treat authorization and business-rule enforcement (who can perform an action, what state transitions are allowed, whether an action can be repeated) as functional coverage, not just a security add-on.
- Cover non-functional scenarios where they affect correctness: input sanitization/encoding, idempotency of repeated requests, and consistent error response shape.
- When planning coverage for a feature, explicitly consider all three angles rather than defaulting to only the happy path:
  - **Functional** — business logic, valid/invalid inputs, state transitions, authorization rules.
  - **Non-functional** — response consistency, idempotency, encoding/sanitization, performance-sensitive paths (see `helpers/performance-metrics.ts`).
  - **Security** — OWASP API Top 10 categories relevant to the endpoint (BOLA, BOPLA, BFLA, mass assignment, injection, SSRF, weak auth/JWT); report these through `SecurityReporter` per the "Security Reporting" section below.

## Playwright Practices

Use:

- Playwright Test Runner, TypeScript, `async`/`await`.
- Page Object Model where it reduces duplication.
- Fixtures for shared setup.
- Stable locators and test ids when available.
- Auto-waiting and web-first assertions.
- Descriptive test and variable names.

Avoid:

- Hard-coded waits — see the exception for `waitForNumberOfSeconds` below.
- XPath unless no stable alternative exists.
- CSS selectors when test ids exist.
- Duplicate setup code.
- Monolithic end-to-end tests that validate multiple business operations.
- `networkidle` readiness checks. The dashboard fires many background fetches after load, so `networkidle` never settles reliably — wait on specific elements/URLs instead.

### Locator Best Practices

Write locators the way users interact with your application, not how the DOM is structured. This makes tests more stable, readable, and resistant to UI changes.

**Locator Priority (Best → Worst):**

| Priority | Locator | Example | Notes |
|----------|---------|---------|-------|
| P1 | `getByRole()` | `page.getByRole('button', { name: 'Login' })` | Best choice — accessible & user-centric |
| P1 | `getByLabel()` | `page.getByLabel('Email')` | Best for form fields |
| P2 | `getByPlaceholder()` | `page.getByPlaceholder('Enter email')` | Good for input fields |
| P2 | `getByText()` | `page.getByText('Welcome')` | Good for static text/headings |
| P2 | `getByTitle()` | `page.getByTitle('Close')` | For icons/tooltips |
| P3 | `getByTestId()` | `page.getByTestId('login-button')` | Excellent for automation-friendly markup |
| P4 | CSS Selector | `.login button` | Use only when necessary |
| P5 | XPath | `//div[2]/span` | Avoid |

**Key patterns:**

```ts
// Buttons — use getByRole with name
await page.getByRole('button', { name: 'Submit' }).click();

// Form fields — use getByLabel
await page.getByLabel('Email').fill('user@test.com');

// Text/headings — use getByText
await expect(page.getByText('Welcome back')).toBeVisible();

// Input fields without labels — use getByPlaceholder
await page.getByPlaceholder('Search...').fill('query');

// Links — use getByRole with name
await page.getByRole('link', { name: 'Documentation' }).click();

// Data attributes — use getByTestId (when added to templates)
await page.getByTestId('save-button').click();

// Chained locators for table rows
await page.getByRole('row', { name: /John/ })
  .getByRole('button', { name: 'Edit' }).click();

// Filter by text content
const card = page.locator('.card').filter({ hasText: 'Premium' });

// Filter by child element
const section = page.locator('article').filter({
  has: page.getByText('Playwright')
});
```

**Do not:**

```ts
//  Avoid XPath
page.locator('//div[3]/button');

//  Avoid CSS classes (they change)
page.locator('.btn-primary');

//  Avoid dynamic indexes
page.locator('.card').nth(5);

//  Avoid hard-coded waits — including "waiting out" a CSS transition before a
//  click; click()'s actionability check already waits for the element to stop
//  moving. See "Page Object Rules" below for the full explanation.
await page.waitForTimeout(3000);
```

**Use LocatorFactory for fallbacks** — when a page element might have multiple possible locators (e.g., a test id, placeholder, or name attribute), use the `LocatorFactory.find()` pattern to try several in priority order:

```ts
// Try test id first, then placeholder, then name attribute
const input = await LocatorFactory.find(
  this.page.getByTestId('username'),
  this.page.getByPlaceholder(/username/i),
  this.page.locator('input[name="username"]')
);
await input.fill('testuser');
```

This pattern is already used in `pages/login.page.ts`, `pages/register.page.ts`, `pages/dashboard.page.ts`, and other page objects — follow it whenever a form field or button might be located via multiple strategies.

### Readiness pattern

`DashboardPage.waitForLoad()` (`pages/dashboard.page.ts`) is the reference implementation: wait for the URL, then for specific visible elements, each with an explicit timeout — never for network activity to go quiet.

```ts
async waitForLoad() {
  await expect(this.page).toHaveURL(/\/dashboard(?:[?#].*)?$/i, { timeout: 7000 });
  await expect(this.page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 7000 });
  await expect(this.page.locator('#balance')).toBeVisible({ timeout: 7000 });
}
```

Follow this shape for any other page with async post-load fetches: assert on URL and on the concrete elements a human would look for, not on network idleness.

## Page Object Rules

Page objects should contain only:

- Locators.
- Page actions.
- Page verifications.

Do not put test flow or business assertions that belong to a spec inside a page object.

Every page object extends `HelperBase` (`pages/helper-base.page.ts`), which owns the shared `Page` instance and common page-level helpers:

```ts
import { Page } from '@playwright/test';

export class HelperBase {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForNumberOfSeconds(timeInSeconds: number) {
    await this.page.waitForTimeout(timeInSeconds * 1000);
  }
}
```

Use `waitForNumberOfSeconds` only when a test explicitly needs a fixed wait for demonstration, debugging, or an application behavior that cannot be asserted directly. Prefer Playwright auto-waiting and web-first assertions for normal test readiness.

**CSS transitions/animations are not an exception.** `click()`'s built-in actionability check already waits for an element to stop moving before interacting with it, so a manual wait before clicking through a CSS transition (e.g. a slide-in mobile menu using `transform`) is redundant, not a real synchronization mechanism. `pages/dashboard.page.ts` (`clickNavigationLink`, `clickNavigationLinkByText`, `logout`) and `pages/money-transfer.page.ts` (`submit`) used to sleep 100-300ms after opening the `.side-panel` menu or before clicking a scrolled-into-view button; both were removed once traced to a `transition: transform 0.3s ease` in `static/dashboard.css` — the assertions already present (`toBeVisible`/`toBeEnabled`) plus the click itself were sufficient. If you find a `waitForTimeout` guarding a click or fill, trace whether the state it's waiting on is something Playwright's actionability checks (visible, stable, enabled, receives events) already cover before assuming it needs the sleep.

A `waitForTimeout` can also mask a missing assertion rather than a real timing need — check whether it's actually standing in for "wait until the app confirms success/failure" before treating it as harmless. `fixtures/api/create-user.helpers.ts`'s UI-registration fallback used to sleep 1000ms after submitting the register form and then unconditionally save the credentials; tracing `templates/register.html` showed the app sets `#message`'s class to `success` or `error` synchronously once its `fetch()` resolves (then redirects after a separate 2s `setTimeout`) — so the fix waits on that class instead, and only saves credentials when it's `success`. The old code would have silently persisted bogus credentials on a failed registration.

Keep locators inside the functional methods that use them instead of defining locator fields in the constructor. This keeps the page object easier to debug, fix, and maintain because each method shows the elements it interacts with directly.

Example:

```ts
export class LoginPage extends HelperBase {
  constructor(page: Page) {
    super(page);
  }

  async login(username: string, password: string) {
    await this.page.getByTestId('username').fill(username);
    await this.page.getByTestId('password').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }

  async verifyLoginSuccessful() {
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  }
}
```

## Page Manager

Use `PageManager` (`pages/page-manager.ts`) to remove repeated page object construction inside tests. It already owns one instance of every page object in this repo (`dashboard`, `loans`, `login`, `moneyTransfer`, `profile`, `register`, `virtualCards`, `billPayments`), each behind an accessor method — construct one `PageManager` per test and interact with page objects through it rather than instantiating them ad hoc. Add a new page object to `PageManager` (private field + accessor) whenever you add a new page object file, so specs never `new` a page object directly.

```ts
test('User can log in', async ({ page }) => {
  const pm = new PageManager(page);

  await pm.login().login(username, password);
  await pm.dashboard().waitForLoad();
});
```

## Assertions

Prefer Playwright assertions:

```ts
await expect(locator).toBeVisible();
```

Avoid manually checking locator state:

```ts
expect(await locator.isVisible()).toBe(true);
```

### Visual regression

Use `expect(locator).toHaveScreenshot('name.png')` scoped to a specific element, not `page.toHaveScreenshot()` for the full page — full-page screenshots pick up unrelated dynamic content (balances, dates, per-user data) and turn into flaky diffs on unrelated changes. Before adding a visual test, check the target element's template for anything per-user/per-run (e.g. `templates/dashboard.html`'s `.side-panel` is safe — logo + static nav links only; balance/greeting/date live in `.main-content`, out of frame). Reference: `tests/ui/specs/visual-leftmenu.spec.ts`.

Playwright screenshot baselines are platform-suffixed (`left-menu-chromium-darwin.png` locally on macOS vs `-linux.png` in CI, which runs `ubuntu-latest`). A baseline generated locally will not satisfy CI — CI needs its own baseline generated in a Linux environment (matching CI's OS) via `--update-snapshots`, committed separately. Don't assume a locally-passing visual test will pass in CI on first run; that's a follow-up step, not implied by local success.

**Outstanding follow-up (as of the `visual-leftmenu.spec.ts` addition):** only macOS (`-darwin.png`) baselines exist for that test. CI will fail on its first run with "no baseline found" until the Linux baselines below are generated once and committed:

```bash
docker compose up -d --build   # app must be reachable at localhost:5001
docker run --rm --network host \
  -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.60.0-jammy \
  npx playwright test tests/ui/specs/visual-leftmenu.spec.ts \
    --project=chromium --project=firefox --project=webkit \
    --project="Mobile Chrome" --project="Mobile Safari" \
    --update-snapshots
```

Use `mcr.microsoft.com/playwright:v1.60.0-jammy` — the tag must match the installed `@playwright/test` version (`package.json`) or browser binaries can mismatch. Commit the resulting `-linux.png` files alongside the existing `-darwin.png` ones in `tests/ui/specs/visual-leftmenu.spec.ts-snapshots/`; don't delete the macOS baselines, they're what local runs on this machine compare against.

## test.step()

Wrap every test body's logical phases in `test.step()` — it groups actions under a named label in the HTML/Allure report and trace viewer, which matters once a test has more than a couple of API calls or UI actions. As of the full-suite retrofit (all of `tests/api/`, `tests/ui/specs/`, `tests/security/`), every spec in this repo follows this convention; keep new specs consistent with it.

**Pattern**: split each test into an "act" step (perform the request/action, return whatever the verification needs) and a "verify" step (assertions + `SecurityReporter` calls):

```ts
const { status, body } = await test.step('Attempt the action', async () => {
  const res = await someApiCall(...);
  return { status: res.status(), body: await res.json().catch(() => null) };
});

await test.step('Verify the expected outcome', async () => {
  expect(status).toBe(200);
  reporter.reportPass(...);
});
```

For a test with 3+ distinct phases (e.g. setup → act → verify, or capture-before → mutate → capture-after → compare), use one step per phase rather than forcing everything into two.

**Keep `test.skip()` guards at the top level, never inside a step.** `test.skip(condition, reason)` works correctly when called from inside a `test.step()` callback (verified: it produces a clean "skipped" result, not a failed step) — but the convention in this repo is still to resolve whatever the skip condition depends on inside a step, then check-and-skip in the top-level test body, matching the existing `if (!session) { reporter.reportSkip(...); test.skip(true, ...); return; }` pattern used throughout. Example:

```ts
const session = await test.step('Establish an account session', async () => {
  return establishAccountSession(api, 'my-feature');
});
if (!session) {
  reporter.reportSkip('Could not establish an account session on this target.');
  await api.dispose();
  test.skip(true, 'No account session available');
  return;
}
```

**Watch for TypeScript narrowing loss across step closures.** A presence check like `if (!user.email) throw ...` only narrows `user.email` to `string` within the same function scope — that narrowing does **not** carry into a *different* `test.step()` callback, because each callback is its own closure over the same mutable object. This compiles fine in the step where the check happened, then fails in a later step referencing the same property. Fix it by destructuring into local `const`s right after the check, before entering any step — primitives copied out this way keep their narrowed type in every subsequent closure:

```ts
const user = createRandomUser('...', false);
if (!user.email || !user.password) throw new Error('...');
const { email, password } = user; // narrowed constants, safe across all later steps

await test.step('Step one', async () => { await login.fillEmail(email); });
await test.step('Step two', async () => { await login.fillPassword(password); }); // would fail to compile with user.password
```

**Never return a raw `Response` object from a step** if the calling code will read `.status()`/`.json()` from a *different* step — resolve `status`/`body` inside the step that made the request and return those plain values instead. Returning the live response and re-deriving status/body later either re-fetches (wasteful, and can silently change behavior if the endpoint isn't idempotent) or breaks type safety across the closure boundary the same way the narrowing issue above does. This was a real bug caught during the retrofit (`tests/security/authentication/plaintext-password-storage.spec.ts` originally called `/debug/users` twice because of this).

## Test Data

- Do not hardcode business data when uniqueness matters.
- Generate unique usernames, emails, account names, and dynamic dates through helpers.
- Reuse authentication with Playwright `storageState` when a workflow does not specifically test login.
- Create or clean up data through API helpers when that makes the UI test smaller and more reliable.

### User/token persistence (`helpers/credentials.ts`)

`test-data/users.json` holds a single primary user plus `token`/`adminToken`.

- `findOrCreateUser(prefix?)` reuses the existing persisted user if one exists; use this by default so repeated runs don't pile up throwaway accounts.
- `createRandomUser(prefix?, persist?)` always mints a brand-new user; use this when a test specifically needs an isolated/fresh identity (e.g. registration flows, tests that mutate the user's own state destructively).
- `loadStoredToken(role)` / `saveStoredToken(token, role)` read/write the persisted JWT for `'user'` or `'admin'`.

### Auth bootstrap (`helpers/auth-bootstrap.ts::ensureDashboardAuthenticated`)

Most UI specs call this in `beforeEach` instead of driving the login form manually. It tries, in order:

1. **Token injection** — load a token from `test-data/users.json` / `API_AUTH_TOKEN` / `ADMIN_AUTH_TOKEN`, or mint a fresh one via the login-endpoint candidates below, then inject it into `localStorage`/`sessionStorage`/cookies and navigate straight to the dashboard.
2. **Real UI credential login** — only if token auth fails to produce a working dashboard session (`LoginPage`, then `DashboardPage.waitForLoad()`).

Pass `role: 'admin'` for admin-only flows (requires `ADMIN_AUTH_TOKEN`, or `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_IDENTIFIER` + `ADMIN_PASSWORD` for the credential fallback), and `requireToken: true` when a test specifically needs token-mode auth and should fail loudly rather than silently falling back to UI login.

### Global Setup & Teardown (Admin Panel Tests)

The admin panel test suite (`tests/ui/specs/admin-panel.spec.ts`) runs under a dedicated `chromium-admin` project with global setup/teardown hooks (`global-setup.ts`, `global-teardown.ts`) for efficiency and data hygiene:

**global-setup.ts** (runs once before all admin tests):

- Launches a browser, navigates to `/login`, authenticates with `ADMIN_USERNAME`/`ADMIN_PASSWORD` (defaults to `admin`/`admin123`)
- Saves the authenticated session state to `storage/admin-auth.json` via `storageState()`
- Admin tests then reuse this pre-authenticated session (skip per-test login overhead)

**global-teardown.ts** (runs once after all admin tests):

- Authenticates with admin credentials via API call to `/login`
- Fetches all users from `/debug/users`
- Deletes any test-created users matching these prefixes: `e2e-`, `global-setup-`, `loan-approval-*`, `admin-panel-*`, `admin-delete-*`, `admin-test-*`, `admin-form-clear-*`, `admin-msg-*`
- Preserves the admin master account (username: `admin`, id: 1)
- Typically deletes 100-200+ test users per run

**Configuration** (in `playwright.config.ts`):

- New `chromium-admin` project with `use: { storageState: 'storage/admin-auth.json' }`
- Main `chromium` project ignores admin tests via `testIgnore` (they only run via the admin project)
- Both projects share the same `globalSetup` and `globalTeardown` hooks

**Result:** ~8-9 seconds total for 66 admin tests (vs 30+ seconds with per-test authentication), and clean database after each run without manual intervention.

### API endpoint discovery

The backend's real routes aren't hardcoded knowledge — API helpers (e.g. `fixtures/api/login.helpers.ts`) probe a list of candidate paths (`/api/auth/login`, `/api/login`, `/login`, `/api/session`) with both JSON and form bodies rather than assuming one canonical route. Follow this pattern for any new endpoint-discovery helper instead of hardcoding a single guessed path.

## Schema Validation

Every API spec calls `helpers/schema-validator.ts::validateSchema(dirName, fileName, responseBody)` on its primary success-path response(s):

```ts
await validateSchema('virtual-cards-schema', 'POST_create', body);
```

This compiles the Ajv schema at `response-schemas/<dirName>/<fileName>.json` and throws (failing the test) if `responseBody` doesn't match — a real content-shape assertion, not just a status-code check.

- **Updating a schema when a response shape change is intentional** (part of app development, not a bug): re-run with `UPDATE_SCHEMAS=1`:
  ```bash
  UPDATE_SCHEMAS=1 BASE_URL=http://localhost:5001 npx playwright test tests/api/<file>.spec.ts --project=chromium
  ```

  Any mismatch then **regenerates** that schema file from the current response (full replace, not a merge — stale types/fields from the old schema are discarded) instead of failing, and logs which file it rewrote. Review `git diff response-schemas/` before committing — same "update the snapshot, then read the diff" discipline as Jest's `--updateSnapshot`. Leaving `UPDATE_SCHEMAS` unset (the default) is strict validation — use that for normal runs and CI.
- **Bootstrapping a schema for a brand-new endpoint**: the same `UPDATE_SCHEMAS=1` run works here too — a missing schema file is treated the same as a mismatch and gets created. So add the `validateSchema(...)` call to your new spec first, do one `UPDATE_SCHEMAS=1` run to populate `response-schemas/`, then review and commit the generated file.
- The legacy `createSchemaFlag` 4th parameter on `validateSchema` still exists (unconditionally overwrites before validating, so it always trivially passes) but `UPDATE_SCHEMAS=1` is the preferred workflow — it only touches files that actually mismatched, and normal (non-flagged) test runs still catch real regressions.

## Security Reporting

API specs instantiate `new SecurityReporter(testInfo)` (`fixtures/helper/security-reporter.ts`) and call one of:

- `reportPass(description, owaspCategory?)` — the secure behavior was confirmed.
- `reportVulnerability(owaspKey, evidence, additionalRecommendations?)` — a real finding; fails the test and attaches a full remediation report.
- `reportWarning(description, recommendations, owaspCategory?)` — a soft concern. **Throws by default**, failing the test, unless `SECURITY_SOFT=1` is set — treat warnings as failures unless you're deliberately doing a soft/exploratory run.
- `reportSkip(reason)` — the check doesn't apply in this environment/config.

Each call attaches a markdown-formatted report as a `text/plain` attachment (`SecurityReporter.attachReport`) — deliberately `text/plain`, not `text/markdown`: Allure2's built-in attachment viewer only renders a fixed set of MIME types inline (`text/plain`, `text/csv`, `application/json`, `image/*`, etc.); `text/markdown` isn't one of them and falls back to a bare "download to view" link instead of showing the content in the report. It also — via `allure-js-commons/sync` (`SecurityReporter.addAllureMetadata`), not `testInfo.annotations` — sets real Allure labels: `severity` (mapped from `riskLevel`), `epic` ("OWASP API Security Top 10"), `story` (the OWASP category name), `tag` (e.g. "API3"), `feature` (test title before the first `:`), and a `link` per reference. `owaspKey` must be one of the keys in `OWASP_VULNERABILITIES`. There is no LLM/AI-specific OWASP key, so AI-chat findings use the closest-fitting API Top 10 key.

**AI chat (`FakeLLMAgent`, `app.py`):** a deterministic, fully local rule-based agent (no external LLM/API key) that reproduces the root cause of prompt injection — its system prompt and the caller's message are concatenated into one string with no role boundary before pattern-matching. It has three "tools" (`tool_get_balance`, `tool_list_recent_transactions`, `tool_transfer_funds` — the last is dry-run only, never writes to `balance`) invoked via naive regex extraction over the raw message, and every `/api/ai/chat*` call is persisted to a `chat_logs` table (`database.py`) readable without authentication via `GET /api/ai/chat-logs`. When adding tests for this behavior, keep mapping findings to the closest API Top 10 key as above (e.g. `API1_BOLA` for the tool-mediated cross-account lookup, `API8_SECURITY_MISCONFIGURATION` for system-prompt leakage and the unescaped-output XSS, consistent with the existing `tests/api/xss.spec.ts` convention).

Use the `allure-js-commons/sync` functions directly (not `testInfo.annotations.push({ type: 'epic', ... })`) if you ever add more Allure metadata here — `allure-playwright` only converts an annotation into a real label when its `type` is the `allure.label.<name>` string form; a bare type like `'epic'` silently becomes a fake `"epic: ..."` step instead of a label. This was the case here until it was fixed — don't reintroduce it.

Established key-choice convention across existing specs — follow this when picking a key for a new finding:

| Key                                | Use for                                                                                                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API1_BOLA`                      | Object-level authorization bypass, including impersonation via a forged JWT                                                                                                                                     |
| `API2_AUTH`                      | Authentication weaknesses: missing auth, insecure token transmission (query string/cookie/form), forged-token rejection confirmations, session/logout/cookie hardening gaps                                     |
| `API3_DATA_EXPOSURE`             | Excessive/unmasked data in a response (full card numbers, account numbers, plaintext passwords)                                                                                                                 |
| `API4_RATE_LIMIT`                | Missing or bypassable rate limiting (including payload-size and PIN-bruteforce throttling)                                                                                                                      |
| `API5_BFLA`                      | Function-level authorization bypass (a non-privileged role reaching an admin-only action, e.g. loan approval)                                                                                                   |
| `API6_MASS_ASSIGNMENT`           | Missing validation on a numeric or reference business field (negative/zero amounts, unvalidated foreign-key-like fields such as`to_account`/`biller_id`), or extra request fields writing sensitive columns |
| `API7_MISCONFIGURATION`          | Missing/misconfigured security headers (CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Permissions-Policy, Referrer-Policy) and SSRF                                                                       |
| `API8_SECURITY_MISCONFIGURATION` | Raw/detailed error message exposure (SQL syntax errors, Python tracebacks reaching the client), permissive CORS                                                                                                 |
| `API9_ASSET_MGMT`                | Unauthenticated debug/discovery endpoints, dependency/supply-chain findings                                                                                                                                     |

Note: `OWASP_VULNERABILITIES` has some pre-existing key-name-vs-`.name`-string mismatches (e.g. `API7_MISCONFIGURATION`'s `.name` is "Server Side Request Forgery"; `API8_SECURITY_MISCONFIGURATION`'s `.description` talks about injection). These are intentional/pre-existing — don't "fix" them as a side effect of an unrelated change.

### JWT forgery caveat

`auth.py` derives `JWT_SECRET` from the environment (`os.environ.get('JWT_SECRET')`), falling back to a random per-process secret if unset — it is **no longer a hardcoded value**. `fixtures/api/jwt-forge.helpers.ts::forgeToken` (signs with the old hardcoded secret) is kept for documentation/regression purposes, but any test using it must branch on the actual outcome — `reportVulnerability` only if impersonation genuinely succeeds, else `reportPass` confirming the rejection — rather than assuming the forged token validates. See the forged-token tests in `tests/api/loans.spec.ts`, `tests/api/ai-chat.spec.ts`, and `tests/api/money-transfer.spec.ts` for the established pattern.

## Test Reporting (Allure)

`playwright.config.ts` runs three reporters together: `html` (Playwright's own report), `list` (console), and `allure-playwright` (writes raw results to `allure-results/`). All are gitignored — they're per-run output, not committed.

- `npm run allure:annotate` — runs `scripts/annotate-allure-results.js` against `allure-results/` (see below); also runs automatically as the first step of `allure:generate`.
- `npm run allure:generate` — annotates, then builds a static `allure-report/` from `allure-results/` via the local `allure-commandline` binary.
- `npm run allure:open` — serves the generated `allure-report/` in a browser.
- `npm run allure:report` — generate + open in one step.

**API vs UI split (Behaviors graph):** `scripts/annotate-allure-results.js` post-processes every `allure-results/*-result.json` to add an `epic` label ("API Tests" or "UI Tests"), a `feature` label (from the spec filename), and a `layer` label (`api`/`ui`) derived from the spec's file path — but only where a label of that name isn't already set. `SecurityReporter` (see "Security Reporting" above) sets its own `epic`/`feature`/`severity`/`story`/`tag` for OWASP-tagged checks, so those checks show up under the "OWASP API Security Top 10" epic instead of being overwritten. Together this means the Allure Behaviors graph shows three groupings: API Tests, UI Tests, and OWASP API Security Top 10.

The script also writes `allure-results/categories.json` (buckets failures into "Security Findings" / "Environment / Connectivity Issues" / "Ignored Tests", falling through to Allure's standard "Product Defects" / "Test Defects" for everything else) and `environment.properties` (`BASE_URL`, Node version, OS, CI flag) for the report's Environment widget.

`SecurityReporter`'s report attachments show up inline (no download click needed — see the `text/plain` note above) in both the Playwright HTML report and the Allure report; the "## Why this result" section in each attachment is the pass/fail explanation, and "## Recommendations" / "## Remediation Steps" are the security suggestions. Playwright's own auto-attached `error-context` files on failure are `text/markdown` (Playwright's choice, not ours) and would normally show as a download-only link in Allure for the same reason — `scripts/annotate-allure-results.js` also walks every result's attachments (including nested ones inside "Before Hooks"/"After Hooks" steps) and rewrites any `text/markdown` to `text/plain`, so nothing in the Allure report requires a download click. Allure additionally groups by suite/feature/epic and shows history/trend if you keep `allure-results` across runs (CI doesn't; it regenerates from a clean job each time). CI uploads both `playwright-report/` and `allure-report/` as workflow artifacts.

## Admin Panel Test Suite

**Reference Implementation:** `tests/ui/specs/admin-panel.spec.ts` (66 tests across 3 phases)

The admin panel suite is a complete example of comprehensive, phased test coverage for a complex feature:

- **Phase 1** (22 tests) — core functionality: authentication, user management, account creation, loan approvals, navigation, message feedback
- **Phase 2** (22 tests) — error handling & validation: form edge cases (empty/long inputs, special characters), duplicate detection, error recovery, input security (XSS/SQL injection)
- **Phase 3** (22 tests) — advanced scenarios: responsive design (mobile/tablet/desktop), performance metrics, data exposure, concurrent operations, OWASP compliance, edge cases

**Page Object:** `pages/admin-panel.page.ts` — 30+ methods for table interactions, form management, message feedback, navigation, and verification

**PageManager Integration:** accessor added to `pages/page-manager.ts` — `pm.adminPanel()`

**Global Setup & Teardown:** Admin tests run under the `chromium-admin` project with `global-setup.ts`/`global-teardown.ts` hooks (see "Global Setup & Teardown" section above for details). Tests do NOT call `ensureDashboardAuthenticated()` — they reuse the pre-authenticated session from global setup instead.

**Run the suite:**

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin123 npx playwright test tests/ui/specs/admin-panel.spec.ts
```

The global setup runs once, authenticates, and caches the session. All 66 tests then run concurrently (or sequentially depending on config) without re-authenticating, improving speed from 30+ seconds (per-test auth) to ~8-9 seconds (shared session).

**Key patterns demonstrated:**

- **Shared authentication:** reuse pre-authenticated session from global setup instead of per-test login
- **Automatic cleanup:** global teardown auto-deletes all test-created users after tests complete
- **Pagination handling:** tables limited to 25 items per page; test IDs enable reliable navigation
- **Form validation:** separate tests for empty fields, long inputs, special characters, duplication
- **Error scenarios:** tests handle edge cases gracefully (skips when data unavailable, robust error checking)
- **Security coverage:** XSS/SQL injection payload testing, sensitive data exposure checks, OWASP categories (API1, API3, API4, API6, API8)
- **Responsive design:** tests at mobile (375x667), tablet (768x1024), and desktop (1920x1080) breakpoints
- **Concurrent operations:** form submission while message showing, pagination during form visibility
- **Data validation:** loan amount validation, pending count tracking, approval state verification

## Adding a New Feature (checklist)

When wiring up tests for an endpoint/page that doesn't have coverage yet:

1. Add an API helper in `fixtures/api/<feature>.helpers.ts` (probe endpoint candidates if the route isn't already known elsewhere in the app).
2. Add a page object in `pages/<feature>.page.ts` extending `HelperBase`, and register it in `pages/page-manager.ts`.
3. Write the API spec in `tests/api/<feature>.spec.ts`: cover functional/non-functional/security angles per "Test Design" above, call `validateSchema(...)` on success responses, and report security checks via `SecurityReporter`.
4. Do one `UPDATE_SCHEMAS=1` run to generate `response-schemas/<feature>-schema/`, then review and commit the generated JSON.
5. Write the UI spec in `tests/ui/specs/<feature>.spec.ts` using `ensureDashboardAuthenticated` in `beforeEach` and the `PageManager`.

Consider the **three-phase approach** used in the admin panel suite:

- **Phase 1:** Core happy path and basic functionality (18 tests covering auth, CRUD, navigation)
- **Phase 2:** Error handling, validation, and security basics (22 tests covering form validation, error recovery, input security)
- **Phase 3:** Advanced scenarios, responsive design, and OWASP compliance (26 tests covering all breakpoints, concurrent ops, compliance)
