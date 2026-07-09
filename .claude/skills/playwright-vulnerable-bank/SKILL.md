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
```

There are no barrel/`index.ts` re-export files in `pages/`, `fixtures/api/`, or `fixtures/helper/`. Every spec imports directly from the specific module it needs (e.g. `from '../../pages/dashboard.page'`). Follow that for new files — don't add a barrel.

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
2. **Real UI credential login** — only if token auth fails to produce a working dashboard session (`LoginPage` → `DashboardPage.waitForLoad()`).

Pass `role: 'admin'` for admin-only flows (requires `ADMIN_AUTH_TOKEN`, or `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_IDENTIFIER` + `ADMIN_PASSWORD` for the credential fallback), and `requireToken: true` when a test specifically needs token-mode auth and should fail loudly rather than silently falling back to UI login.

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

Each call attaches a markdown report to the Playwright test result and adds annotations (severity, OWASP tag, links). `owaspKey` must be one of the keys in `OWASP_VULNERABILITIES`. There is no LLM/AI-specific OWASP key, so AI-chat findings use the closest-fitting API Top 10 key.

Established key-choice convention across existing specs — follow this when picking a key for a new finding:

| Key | Use for |
|---|---|
| `API1_BOLA` | Object-level authorization bypass, including impersonation via a forged JWT |
| `API2_AUTH` | Authentication weaknesses: missing auth, insecure token transmission (query string/cookie/form), forged-token rejection confirmations |
| `API3_DATA_EXPOSURE` | Excessive/unmasked data in a response (full card numbers, account numbers) |
| `API4_RATE_LIMIT` | Missing or bypassable rate limiting |
| `API6_MASS_ASSIGNMENT` | Missing validation on a numeric or reference business field (negative/zero amounts, unvalidated foreign-key-like fields such as `to_account`/`biller_id`) |
| `API8_SECURITY_MISCONFIGURATION` | Raw/detailed error message exposure (SQL syntax errors, Python tracebacks reaching the client) |
| `API9_ASSET_MGMT` | Unauthenticated debug/discovery endpoints |

Note: `OWASP_VULNERABILITIES` has some pre-existing key-name-vs-`.name`-string mismatches (e.g. `API7_MISCONFIGURATION`'s `.name` is "Server Side Request Forgery"; `API8_SECURITY_MISCONFIGURATION`'s `.description` talks about injection). These are intentional/pre-existing — don't "fix" them as a side effect of an unrelated change.

### JWT forgery caveat

`auth.py` derives `JWT_SECRET` from the environment (`os.environ.get('JWT_SECRET')`), falling back to a random per-process secret if unset — it is **no longer a hardcoded value**. `fixtures/api/jwt-forge.helpers.ts::forgeToken` (signs with the old hardcoded secret) is kept for documentation/regression purposes, but any test using it must branch on the actual outcome — `reportVulnerability` only if impersonation genuinely succeeds, else `reportPass` confirming the rejection — rather than assuming the forged token validates. See the forged-token tests in `tests/api/loans.spec.ts`, `tests/api/ai-chat.spec.ts`, and `tests/api/money-transfer.spec.ts` for the established pattern.

## Adding a New Feature (checklist)

When wiring up tests for an endpoint/page that doesn't have coverage yet:

1. Add an API helper in `fixtures/api/<feature>.helpers.ts` (probe endpoint candidates if the route isn't already known elsewhere in the app).
2. Add a page object in `pages/<feature>.page.ts` extending `HelperBase`, and register it in `pages/page-manager.ts`.
3. Write the API spec in `tests/api/<feature>.spec.ts`: cover functional/non-functional/security angles per "Test Design" above, call `validateSchema(...)` on success responses, and report security checks via `SecurityReporter`.
4. Do one `UPDATE_SCHEMAS=1` run to generate `response-schemas/<feature>-schema/`, then review and commit the generated JSON.
5. Write the UI spec in `tests/ui/specs/<feature>.spec.ts` using `ensureDashboardAuthenticated` in `beforeEach` and the `PageManager`.
