# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This repo has two halves:

1. **Vulnerable Bank** (`app.py`, `auth.py`, `database.py`, `templates/`, `static/`) — a deliberately vulnerable Flask + PostgreSQL banking app used for security-testing education (SQL injection, BOLA/BOPLA, weak JWT, mass assignment, SSRF, prompt injection, etc.). See `README.md` for the full list of intentional vulnerabilities and manual testing flows — do not "fix" these unless explicitly asked, they are the point of the app.
2. **Playwright TypeScript test suite** (`tests/`, `pages/`, `fixtures/`, `helpers/`) — UI and API automation against that app, including OWASP-style security assertions.

Most Claude Code work in this repo is on the test suite, not the vulnerable app itself.

## Commands

Run the app (Docker, from repo root):
```bash
docker compose up -d --build      # starts Flask app on :5001 and Postgres
docker compose down -v            # tear down
docker compose exec db psql -U postgres -d vulnerable_bank   # inspect DB
```

Run tests (app must already be running):
```bash
BASE_URL=http://localhost:5001 npm test          # full suite, all browsers (chromium/firefox/webkit)
npx playwright test tests/api/login.spec.ts       # single file
npx playwright test -g "should allow logout"      # single test by name
npx playwright test --project=chromium            # single browser
npx playwright show-report                        # open HTML report after a run
```

`playwright.config.ts` defaults `baseURL` to `http://localhost:5001` if `BASE_URL` is unset. Tests run fully parallel locally; CI forces `workers: 1` and 2 retries.

No lint/typecheck script is wired into `package.json` (`eslint.config.mts` is an empty ruleset); use `npx tsc --noEmit` against `tsconfig.json` if you need to typecheck the test suite.

## Test suite architecture

```
pages/      Page Object Model — locators + actions + verifications, extend HelperBase
  page-manager.ts   PageManager — owns one instance of every page object, exposed via accessor methods
fixtures/
  api/      API request helpers (one <feature>.helpers.ts per tested endpoint group), endpoint discovery
  helper/   SecurityReporter — OWASP-tagged pass/fail/warning reporting, attached to test results
helpers/    cross-cutting utilities: auth bootstrap, credential persistence, schema validation, perf metrics
response-schemas/  Ajv/JSON-Schema files, one subdir per feature (e.g. login-schema/, virtual-cards-schema/),
                    each holding <METHOD>_<endpoint>.json — see "Schema validation" below
test-data/  persisted fixtures (users.json holds the shared test user + tokens)
tests/
  api/      API-only specs
  ui/specs/ UI specs (Playwright Page Object Model via pages/)
```

Note: there are no barrel/`index.ts` re-export files in `pages/`, `fixtures/api/`, or `fixtures/helper/` (removed as unused — every spec file always imported directly from the specific `.ts` file it needed, e.g. `from '../../pages/dashboard.page'`). Follow that convention for new files: import the specific module directly, don't add a barrel.

Full conventions live in `.claude/skills/playwright-vulnerable-bank/SKILL.md` — read it before writing or editing tests. Key points:

- **Readiness checks are UI-based, never `networkidle`.** The dashboard fires many background fetches after load, so wait on specific elements/URLs instead (see `DashboardPage.waitForLoad()` in `pages/dashboard.page.ts` for the pattern).
- **Page objects** hold only locators/actions/verifications, no test-flow assertions. Keep locators inside the methods that use them rather than as constructor fields (easier to debug per-method).
- **Auth bootstrap** (`helpers/auth-bootstrap.ts::ensureDashboardAuthenticated`) tries token injection first (via `test-data/users.json` / `API_AUTH_TOKEN` / `ADMIN_AUTH_TOKEN` env), minting a fresh token through `/api/auth/login`-style candidate endpoints if none is stored, and falls back to real UI credential login only if token auth fails. Most UI specs call this in `beforeEach` rather than logging in manually.
- **User/token persistence**: `helpers/credentials.ts` reads/writes `test-data/users.json` (single primary user + `token`/`adminToken`). `findOrCreateUser()` reuses the existing user; `createRandomUser()` always mints a new one.
- **API endpoint discovery**: since the backend's real routes aren't hardcoded knowledge, API helpers (e.g. `fixtures/api/login.helpers.ts`) probe a list of candidate paths (`/api/auth/login`, `/api/login`, `/login`, `/api/session`) with both form and JSON bodies rather than assuming one canonical route.
- **Schema validation**: every API spec calls `helpers/schema-validator.ts::validateSchema(dirName, fileName, responseBody)` on its primary success-path response(s), e.g. `await validateSchema('virtual-cards-schema', 'POST_create', body)`. This compiles the Ajv schema at `response-schemas/<dirName>/<fileName>.json` and throws (failing the test) if `responseBody` doesn't match — a real content-shape assertion, not just a status-code check. Import it directly: `import { validateSchema } from '../../helpers/schema-validator'`.
  - **Updating a schema when a response shape change is intentional** (part of app development, not a bug): re-run with `UPDATE_SCHEMAS=1`, e.g. `UPDATE_SCHEMAS=1 BASE_URL=http://localhost:5001 npx playwright test tests/api/<file>.spec.ts --project=chromium`. Any mismatch then **regenerates** that schema file from the current response (full replace, not a merge — stale types/fields from the old schema are discarded) instead of failing, and logs which file it rewrote. Review `git diff response-schemas/` before committing, the same "update the snapshot, then read the diff" discipline as Jest's `--updateSnapshot`. Leaving `UPDATE_SCHEMAS` unset (the default) is strict validation — use that for normal runs and CI.
  - **Bootstrapping a schema for a brand-new endpoint you're adding a test for**: same `UPDATE_SCHEMAS=1` run works here too (a missing schema file is treated the same as a mismatch and gets created), so a fresh feature's schemas can be generated by adding the `validateSchema(...)` calls first, then doing one `UPDATE_SCHEMAS=1` run to populate `response-schemas/`, then reviewing and committing the generated files.
  - The legacy `createSchemaFlag` 4th parameter on `validateSchema` still exists (unconditionally overwrites before validating, so it always trivially passes) but `UPDATE_SCHEMAS=1` is the preferred workflow — it only touches files that actually mismatched, and normal (non-flagged) test runs still catch real regressions.
- **Security reporting**: API specs instantiate `new SecurityReporter(testInfo)` (`fixtures/helper/security-reporter.ts`) and call `reportPass`/`reportVulnerability`/`reportWarning`/`reportSkip` with an OWASP API Security Top 10 key (`OWASP_VULNERABILITIES`, e.g. `API1_BOLA`, `API5_BFLA`). This attaches a markdown report to the Playwright test result and adds annotations. `reportWarning` throws unless `SECURITY_SOFT=1` is set — treat warnings as failures by default. There is no LLM/AI-specific OWASP key, so AI-chat findings use the closest-fitting API Top 10 key. Established key-choice convention across existing specs: `API1_BOLA` for object-level authorization bypass (including impersonation via a forged JWT); `API2_AUTH` for authentication weaknesses (missing auth, insecure token transmission via query string/cookie/form, forged-token rejection confirmations); `API3_DATA_EXPOSURE` for excessive/unmasked data in a response (full card numbers, account numbers); `API4_RATE_LIMIT` for missing or bypassable rate limiting; `API6_MASS_ASSIGNMENT` for missing validation on a numeric or reference business field (negative/zero amounts, unvalidated foreign-key-like fields such as `to_account`/`biller_id`); `API8_SECURITY_MISCONFIGURATION` for raw/detailed error message exposure (SQL syntax errors, Python tracebacks reaching the client); `API9_ASSET_MGMT` for unauthenticated debug/discovery endpoints. Note the `OWASP_VULNERABILITIES` map has some pre-existing key-name-vs-`.name`-string mismatches (e.g. `API7_MISCONFIGURATION`'s `.name` is "Server Side Request Forgery", `API8_SECURITY_MISCONFIGURATION`'s `.description` talks about injection) — these are intentional/pre-existing, not bugs to fix.
- **Page Manager pattern**: when a spec needs multiple page objects, construct one `PageManager` (`pages/page-manager.ts`) that owns instances and exposes accessor methods (`pm.dashboard()`, `pm.loans()`, etc.), rather than instantiating page objects ad hoc per test. All UI specs use this today.
- **JWT forgery no longer works**: `auth.py` derives `JWT_SECRET` from the environment (`os.environ.get('JWT_SECRET')`), falling back to a random per-process secret if unset — it is no longer a hardcoded value. `fixtures/api/jwt-forge.helpers.ts::forgeToken` (signs with the old hardcoded secret) is kept for documentation/regression purposes, but any test using it must branch on the actual outcome (`reportVulnerability` only if impersonation genuinely succeeds, else `reportPass` confirming the rejection) rather than assuming the forged token validates — see the forged-token tests in `tests/api/loans.spec.ts`, `tests/api/ai-chat.spec.ts`, and `tests/api/money-transfer.spec.ts` for the established pattern.

## Environment

- `.env` (not committed) configures `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` for Postgres. Copy `.env.example` to `.env` for local runs. `DB_HOST=db` is for Docker; use `localhost` for a local Postgres install.
- Test-only env vars: `BASE_URL` (target app), `API_AUTH_TOKEN`/`ADMIN_AUTH_TOKEN` (skip token minting), `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_IDENTIFIER` + `ADMIN_PASSWORD` (admin UI fallback login), `SECURITY_SOFT=1` (downgrade `SecurityReporter.reportWarning` from throwing to warning-only), `UPDATE_SCHEMAS=1` (regenerate mismatched/missing `response-schemas/` files instead of failing — see "Schema validation" above).
- CI (`.github/workflows/playwright.yml`) builds the Docker stack, polls `http://localhost:5001` until ready, then runs `npm test` and uploads the HTML report.
