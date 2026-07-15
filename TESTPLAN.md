# Test Plan — Vulnerable Bank Playwright Suite

## 1. Purpose

Defines what this repo's Playwright suite tests, how, and where coverage currently stands, for the Vulnerable Bank application (`app.py` / Flask + PostgreSQL). This plan is the map; day-to-day conventions live in `.claude/skills/playwright-vulnerable-bank/SKILL.md`, current coverage gaps live in `TODO.md`, and the full list of intended vulnerabilities lives in `README.md`.

**Out of scope:** fixing the application's intentional vulnerabilities. The app is deliberately insecure for security-testing education — a test finding a vulnerability and passing (via `reportVulnerability`) is the suite working correctly, not a bug to fix in `app.py`.

## 2. Application Under Test

Vulnerable Bank: a Flask + PostgreSQL banking app exposing both server-rendered pages (`templates/`) and a JSON API (`app.py`, `auth.py`, `database.py`). Core features: authentication, balance/transactions, money transfers, loan requests, profile picture upload, virtual cards, bill payments, and a local fake-LLM AI customer-support agent. Full feature and vulnerability inventory: `README.md`.

Runs via Docker Compose on `http://localhost:5001` (Flask + Postgres). Local (non-Docker) Python install is also supported per `README.md` but Docker is the default path this suite assumes.

## 3. Test Objectives

Per test, cover three angles (see SKILL.md "Test Design" for the full rules):

1. **Functional** — business logic, valid/invalid inputs, state transitions, authorization rules.
2. **Non-functional** — response-shape consistency (Ajv schema validation), idempotency, encoding/sanitization, perf-sensitive paths.
3. **Security** — OWASP API Security Top 10 categories relevant to the endpoint, reported through `SecurityReporter` with a pass/fail verdict, not just "vulnerability exists in README."

## 4. Test Types

| Type | Location | Mechanism |
|---|---|---|
| API | `tests/api/*.spec.ts` | Direct HTTP via Playwright `request`, response-shape asserted with `validateSchema()`, security findings via `SecurityReporter` |
| UI | `tests/ui/specs/*.spec.ts` | Page Object Model via `pages/` + `PageManager`, driven through `helpers/auth-bootstrap.ts` |
| Visual | `tests/ui/specs/visual-leftmenu.spec.ts` | Playwright screenshot comparison (`*-snapshots/`) |
| Security | `tests/security/<category>/*.spec.ts` | OWASP-style checks organized by category (`abuse/`, `authentication/`, `authorization/`, `cors/`, `crossSiteReqForgery/`, `headers/`, `input/`, `supply-chain/`), reported via the same `SecurityReporter` (re-exported through `tests/security/utils/`); shared probe logic lives in `sec-objects/<category>/<name>.logic.ts` |

There is no dedicated load/perf test type; `helpers/performance-metrics.ts` only tracks schema-validation timing as a side effect of API tests, not standalone perf testing.

## 5. Environment & Execution

```bash
docker compose up -d --build                         # app on :5001, Postgres
BASE_URL=http://localhost:5001 npm test               # full suite, all browsers
npx playwright test tests/api/login.spec.ts            # single file
npx playwright test -g "should allow logout"           # single test
npx playwright test --project=chromium                 # single browser
npx playwright show-report                              # HTML report
docker compose down -v                                  # teardown
```

Key env vars: `BASE_URL`, `API_AUTH_TOKEN`/`ADMIN_AUTH_TOKEN`, `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_IDENTIFIER`+`ADMIN_PASSWORD`, `SECURITY_SOFT=1`, `UPDATE_SCHEMAS=1`. Full list: `CLAUDE.md` "Environment".

CI (`.github/workflows/playwright.yml`) builds the Docker stack, polls until ready, runs `npm test` with `workers: 1` and 2 retries, uploads the HTML report.

## 6. Tools

Playwright Test Runner + TypeScript · Ajv/`ajv-formats` + `genson-js` for schema validation/generation · custom `SecurityReporter` for OWASP-tagged reporting (no external security-scanning tool is wired in — findings are hand-written per endpoint).

## 7. Suite Structure

```
pages/             Page Object Model, extend HelperBase; page-manager.ts owns all instances
fixtures/api/      API request helpers (one <feature>.helpers.ts per endpoint group)
fixtures/helper/   SecurityReporter — OWASP-tagged pass/fail/warning reporting
helpers/           auth bootstrap, credential persistence, schema validation, perf metrics
response-schemas/  Ajv schemas, one subdir per feature
test-data/         users.json — shared test user + tokens
tests/api/         API specs · tests/ui/specs/  UI specs
tests/security/    OWASP-style checks by category; sec-objects/ shared logic, utils/ re-exports
```

Full conventions (Page Object rules, Page Manager, readiness-check pattern, auth bootstrap internals, schema-update workflow, OWASP-key convention table, JWT-forgery caveat): `.claude/skills/playwright-vulnerable-bank/SKILL.md`.

## 8. Feature Coverage Matrix

| Feature | API spec | UI spec | Schema dir |
|---|---|---|---|
| Login / auth | `login.spec.ts` | — (covered via `auth-bootstrap`) | `login-schema/` |
| Registration | `create-user.spec.ts` | `create-user.spec.ts` | `register-schema/` |
| Dashboard / balance | `dashboard.spec.ts` | `dashboard.spec.ts` | `dashboard-schema/` |
| Transactions | `transactions.spec.ts` | — (rendered inside dashboard spec) | `transactions-schema/` |
| Money transfer | `money-transfer.spec.ts` | `money-transfer.spec.ts` | `money-transfer-schema/` |
| Loans | `loans.spec.ts` | `loans.spec.ts` | `loans-schema/` |
| Profile picture upload | `profile.spec.ts` | `profile.spec.ts` | `profile-schema/` |
| Virtual cards | `virtual-cards.spec.ts` | `virtual-cards.spec.ts` | `virtual-cards-schema/` |
| Bill payments | `bill-payments.spec.ts` | `bill-payments.spec.ts` | `bill-payments-schema/` |
| AI customer support | `ai-chat.spec.ts` | — (no UI spec drives the chat widget) | `ai-chat-schema/` |
| Left nav / visual | — | `visual-leftmenu.spec.ts` | — |

Every feature has an API spec with schema validation; UI coverage exists for everything except transactions (subsumed by dashboard) and the AI chat widget (API-only today). `tests/security/` is organized by OWASP category rather than by feature, so it isn't reflected as its own column here — see section 9 for its coverage.

## 9. Security Coverage Summary

A full README-vulnerability-to-test audit was done and is tracked, item by item, in `TODO.md`. Headline status:

- **Well covered (`tests/api/`, `tests/ui/specs/`)**: auth SQL injection, BOLA/BOPLA/mass assignment, excessive data exposure, SSRF, insecure token transmission (query-string), verbose error-message exposure, virtual-card and bill-payment business-logic flaws, stored XSS (server-side `{{ username | safe }}` reflection and client-side `innerHTML` DOM execution via transfer description).
- **Well covered (`tests/security/`)**: a dedicated OWASP-style suite organized by category — `authentication/` (cookies, JWT forgery, session timeout/fixation, logout invalidation, bruteforce/lockout, PIN bruteforce, password policy, plaintext password storage, CSP + token-storage hardening, generic login errors, Werkzeug debugger exposure), `authorization/` (virtual-card-create mass assignment), `abuse/` (rate limiting, payload size), `cors/`, `crossSiteReqForgery/` (live CSRF against `/transfer`), `headers/` (clickjacking, HSTS, nosniff, Permissions-Policy, Referrer-Policy across representative endpoints), `input/` (file-upload type/size/naming/path-traversal), and `supply-chain/` (`npm audit` against this repo's own dependencies).
- **Already fixed, docs updated**: hardcoded/weak JWT secret — `auth.py` now derives it from the environment; forged-token tests confirm rejection and report pass rather than a live finding. `README.md`'s vulnerability list has been corrected to match.
- **Well covered (AI chat)**: `LocalAIAgent` was replaced with `FakeLLMAgent` (`app.py`) — a deterministic, fully local rule-based agent (no external LLM/API key) that reproduces the root cause of prompt injection (system prompt and user message concatenated with no role boundary). `tests/api/ai-chat.spec.ts` now covers system-prompt/override-code leakage, tool-mediated cross-account BOLA, an unconfirmed agent-proposed fund transfer (dry-run only), stored XSS via unescaped `formatted_html`, and an unauthenticated `GET /api/ai/chat-logs` audit-log leak — all previously documented-but-dead against the old echo-only stub.
- **Intentionally not covered**:
  - Balance-check-then-deduct race conditions (transfers, bill payments, card balances) — `app.py` runs single-threaded, so a `Promise.all`-based race test would false-negative; documented in code comments rather than silently skipped.
  - RAG-specific vulnerabilities (poisoned knowledge-base documents, cross-tenant retrieval, hallucination-on-uncertainty) — no RAG/knowledge-base feature exists in the app; would need that feature built first.
  - Card activity monitoring — a logging/observability property, not a request/response behavior any black-box HTTP assertion can observe.
- **One open finding, not yet mitigated**: Flask running with `DEBUG=True` lets the legacy SQLite-backed `/api/login` route (`auth.py`, still registered via `init_auth_routes(app)`) leak a full interactive Werkzeug debugger traceback on an unhandled exception — confirmed CRITICAL-adjacent (`tests/security/authentication/broken-authentication.spec.ts`). See `TODO.md` for remediation options.

## 10. Test Data Management

Single shared primary user + tokens persisted in `test-data/users.json` via `helpers/credentials.ts`. `findOrCreateUser()` reuses it (default for most specs); `createRandomUser()` mints an always-fresh identity for tests needing isolation (e.g. registration duplicate-username checks, BOLA cross-user probes). No seed/reset script exists — the suite is written to tolerate a persistent shared user across runs rather than requiring a clean DB each time.

## 11. Entry / Exit Criteria

**Entry:** app + Postgres running and reachable at `BASE_URL` (Docker Compose healthy); `.env` present.

**Exit for a change:** all specs green under `npx playwright test` for the affected file(s); any new/changed API response shape validated (schema regenerated via `UPDATE_SCHEMAS=1` and reviewed, not blindly committed); any new security check reports through `SecurityReporter` with the correct OWASP key (see SKILL.md's key-choice table) rather than a bare `expect()`.

## 12. Adding Coverage for a New Feature

See SKILL.md's "Adding a New Feature (checklist)": API helper, then page object + `PageManager` registration, then API spec (functional/non-functional/security angles + schema validation), then `UPDATE_SCHEMAS=1` run, then UI spec using `ensureDashboardAuthenticated` + `PageManager`.

## 13. Open Items

Tracked in `TODO.md`, prioritized. Re-run the README-vs-tests audit periodically (e.g. after adding a new `Implemented Vulnerabilities` bullet to `README.md`) rather than assuming this plan's coverage matrix stays accurate indefinitely.
