# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This repo has two halves:

1. **Vulnerable Bank** (`app.py`, `auth.py`, `database.py`, `templates/`, `static/`) — a deliberately vulnerable Flask + PostgreSQL banking app used for security-testing education (SQL injection, BOLA/BOPLA, weak JWT, mass assignment, SSRF, prompt injection, etc.). See `README.md` for the full list of intentional vulnerabilities and manual testing flows — do not "fix" these unless explicitly asked, they are the point of the app.
2. **Playwright TypeScript test suite** (`tests/`, `pages/`, `fixtures/`, `helpers/`) — UI and API automation against that app, including OWASP-style security assertions.

Most Claude Code work in this repo is on the test suite, not the vulnerable app itself.

Do not use emoji anywhere in this repo — docs, code, commit messages, or app UI (`templates/`). Existing emoji were stripped project-wide; don't reintroduce them in new files or edits.

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
npm run allure:generate                           # build Allure report from allure-results/ into allure-report/
npm run allure:open                                # serve the generated Allure report
npm run allure:report                              # generate + open in one step
```

## Test suite architecture

```
pages/             Page Object Model, extend HelperBase; page-manager.ts owns all instances
fixtures/api/      API request helpers (one <feature>.helpers.ts per endpoint group)
fixtures/helper/   SecurityReporter — OWASP-tagged pass/fail/warning reporting
helpers/           auth bootstrap, credential persistence, schema validation, perf metrics
response-schemas/  Ajv schemas, one subdir per feature
test-data/         users.json — shared test user + tokens
tests/api/         API specs · tests/ui/specs/  UI specs
tests/security/    OWASP-style checks by category (auth, CORS, CSRF, headers, file upload, abuse, supply-chain)
```

No barrel/`index.ts` files — import each module directly.

**Before writing or editing any test, read `.claude/skills/playwright-vulnerable-bank/SKILL.md`** — the detailed reference (conventions, auth/schema/security workflows, feature checklist). Keep new detail there, not here.

## Environment

- `.env` (not committed) configures `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` for Postgres. Copy `.env.example` to `.env` for local runs. `DB_HOST=db` is for Docker; use `localhost` for a local Postgres install.
- Test-only env vars: `BASE_URL` (target app), `API_AUTH_TOKEN`/`ADMIN_AUTH_TOKEN` (skip token minting), `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_IDENTIFIER` + `ADMIN_PASSWORD` (admin UI fallback login), `SECURITY_SOFT=1` (downgrade `SecurityReporter.reportWarning` from throwing to warning-only), `UPDATE_SCHEMAS=1` (regenerate mismatched/missing `response-schemas/` files instead of failing — see SKILL.md "Schema Validation").
- CI (`.github/workflows/playwright.yml`) builds the Docker stack, polls `http://localhost:5001` until ready, then runs `npm test` and uploads both the Playwright HTML report and the generated Allure report as artifacts.
- Allure: `playwright.config.ts` runs the `allure-playwright` reporter alongside `html`/`list`, writing raw results to `allure-results/` (gitignored). `package.json`'s `pretest` script clears `allure-results/` before every `npm test` run, so results never mix across runs. Run `npm run allure:generate` to build `allure-report/` (gitignored) from those results, then `npm run allure:open` to view it — both dirs are per-run output, not committed.

## Claude Code permissions policy (3Cs)

`.claude/settings.json` (committed, team-wide) implements a Contain/Curate/Control governance model for autonomous work in this repo:

- **Contain** — for large or long-running batches of test-writing work, prefer a git worktree (`EnterWorktree` / `claude --worktree`) so edits land on an isolated branch rather than the main checkout. Background sessions already default to worktree isolation (`bgIsolation`) until one is explicitly entered.
- **Curate** — this file plus `.claude/skills/playwright-vulnerable-bank/SKILL.md` define the working context (conventions, directory layout, schema/security workflow) that scopes what an agent should touch, rather than leaving it to infer scope from the whole repo.
- **Control** — `.claude/settings.json` auto-allows `Read` everywhere and `Edit`/`Write` under `tests/**`, `pages/**`, `fixtures/**`, `helpers/**`, `response-schemas/**`, `test-data/**`, plus test-running commands (`npm test`, `npx playwright test*`) and read-only git (`status`/`diff`/`log`/`branch --show-current`). It requires explicit confirmation (`ask`) for `app.py`, `auth.py`, `database.py`, `docker-compose*.yml`, `Dockerfile`, `requirements.txt`, `.env`/`.env.example`, `.github/workflows/**`, and `package.json` — the "prod-adjacent"/CI-surface files where a mistake is harder to reverse — and for destructive git operations (force-push, `reset --hard`, `clean -f`, `branch -D`), even though those already fall through to the default ask behavior; they're listed explicitly so a future broad allow rule can't silently shadow them.

This means test-suite work (the bulk of what Claude Code does here, per "Project overview" above) can proceed with minimal interruption, while anything touching the vulnerable app's actual code, infra, or CI still requires a human to confirm. Update the allow/ask lists here (and in this section) together if the policy changes — don't let `.claude/settings.json` drift from what this file describes.
