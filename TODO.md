# Test coverage gaps — from README vulnerability audit

Source: initial coverage audit of `README.md` "Implemented Vulnerabilities" against `tests/api/*.spec.ts` and `tests/ui/specs/*.spec.ts`, plus gaps found while expanding `tests/security/`. Unchecked items below have zero or only superficial test coverage today.

## New findings (from mirroring another project's `security/` test-suite layout — not in the original README audit)

- [x] **Werkzeug interactive debugger exposure** — `tests/security/authentication/broken-authentication.spec.ts` discovered that Flask is running with `DEBUG=True`: the legacy `/api/login` route (still registered via `init_auth_routes(app)` in `app.py`, SQLite-backed, separate from the real Postgres-backed `/login`) throws an unhandled `sqlite3.OperationalError` and returns the full interactive Werkzeug debugger page (file paths, stack frames, library versions). The console itself is PIN-locked (not bypassed/tested — that would cross into actual RCE-adjacent exploitation, deliberately out of scope), but the traceback disclosure alone is a confirmed CRITICAL-adjacent finding. Consider: disabling debug mode for any shared/deployed instance, and/or removing the dead `/api/login`, `/api/check_balance`, `/api/transfer` routes in `auth.py` entirely.
- [ ] **Card/balance race conditions** (virtual cards, bill payments, transfers) — intentionally left uncovered because `app.py` runs single-threaded (documented in code comments in `money-transfer.spec.ts:29` and `bill-payments.spec.ts:41`). Revisit only if the app is ever run with `threaded=True` or behind a real WSGI server.

## README category 7 (Virtual Card Vulnerabilities) — final item

- [ ] **Lack of card activity monitoring** — not testable via black-box HTTP: this is a logging/observability property (does the app record and alert on card usage patterns?), not a request/response behavior any Playwright assertion can observe. Would need direct access to application/audit logs, which is out of scope for this suite.
