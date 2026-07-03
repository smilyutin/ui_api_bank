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
fixtures/
  api/      API request helpers, Ajv schemas, response types, endpoint discovery
  helper/   SecurityReporter — OWASP-tagged pass/fail/warning reporting, attached to test results
  pom/      barrel export for page objects used by API-side tests
helpers/    cross-cutting utilities: auth bootstrap, credential persistence, schema validation, perf metrics
test-data/  persisted fixtures (users.json holds the shared test user + tokens)
tests/
  api/      API-only specs
  ui/specs/ UI specs (Playwright Page Object Model via pages/)
```

Full conventions live in `.claude/skills/playwright-vulnerable-bank/SKILL.md` — read it before writing or editing tests. Key points:

- **Readiness checks are UI-based, never `networkidle`.** The dashboard fires many background fetches after load, so wait on specific elements/URLs instead (see `DashboardPage.waitForLoad()` in `pages/dashboard.page.ts` for the pattern).
- **Page objects** hold only locators/actions/verifications, no test-flow assertions. Keep locators inside the methods that use them rather than as constructor fields (easier to debug per-method).
- **Auth bootstrap** (`helpers/auth-bootstrap.ts::ensureDashboardAuthenticated`) tries token injection first (via `test-data/users.json` / `API_AUTH_TOKEN` / `ADMIN_AUTH_TOKEN` env), minting a fresh token through `/api/auth/login`-style candidate endpoints if none is stored, and falls back to real UI credential login only if token auth fails. Most UI specs call this in `beforeEach` rather than logging in manually.
- **User/token persistence**: `helpers/credentials.ts` reads/writes `test-data/users.json` (single primary user + `token`/`adminToken`). `findOrCreateUser()` reuses the existing user; `createRandomUser()` always mints a new one.
- **API endpoint discovery**: since the backend's real routes aren't hardcoded knowledge, API helpers (e.g. `fixtures/api/login.helpers.ts`) probe a list of candidate paths (`/api/auth/login`, `/api/login`, `/login`, `/api/session`) with both form and JSON bodies rather than assuming one canonical route.
- **Schema validation**: `helpers/schema-validator.ts::validateSchema(dirName, fileName, body)` validates JSON responses against Ajv schemas in `response-schemas/<name>-schema/GET_<name>_schema.JSON`, referenced via `fixtures/api/schemas.ts::apiSchemas`. Pass `createSchemaFlag=true` to regenerate a schema from a live response instead of hand-writing one.
- **Security reporting**: API specs instantiate `new SecurityReporter(testInfo)` (`fixtures/helper/security-reporter.ts`) and call `reportPass`/`reportVulnerability`/`reportWarning`/`reportSkip` with an OWASP API Security Top 10 key (`OWASP_VULNERABILITIES`, e.g. `API1_BOLA`, `API5_BFLA`). This attaches a markdown report to the Playwright test result and adds annotations. `reportWarning` throws unless `SECURITY_SOFT=1` is set — treat warnings as failures by default.
- **Page Manager pattern**: when a spec needs multiple page objects, construct one PageManager class that owns instances and exposes accessor methods, rather than instantiating page objects ad hoc per test (see SKILL.md for the exact shape).

## Environment

- `.env` (not committed) configures `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` for Postgres. Copy `.env.example` to `.env` for local runs. `DB_HOST=db` is for Docker; use `localhost` for a local Postgres install.
- Test-only env vars: `BASE_URL` (target app), `API_AUTH_TOKEN`/`ADMIN_AUTH_TOKEN` (skip token minting), `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_IDENTIFIER` + `ADMIN_PASSWORD` (admin UI fallback login), `SECURITY_SOFT=1` (downgrade `SecurityReporter.reportWarning` from throwing to warning-only).
- CI (`.github/workflows/playwright.yml`) builds the Docker stack, polls `http://localhost:5001` until ready, then runs `npm test` and uploads the HTML report.
