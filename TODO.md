# Test coverage gaps — from README vulnerability audit

Source: coverage audit of `README.md` "Implemented Vulnerabilities" against `tests/api/*.spec.ts` and `tests/ui/specs/*.spec.ts`. Each item below has zero or only superficial test coverage today.

## High priority — real gaps, straightforward to add

- [ ] **XSS** — no test anywhere in `tests/`. Add to a new `tests/api/xss.spec.ts` or fold into existing specs (money-transfer notes/description fields, profile name, bill-payment reference, AI chat message) — probe `<script>`/`<img onerror>` payloads and assert the value is reflected unescaped somewhere (stored or reflected).
- [ ] **CSRF** — no test anywhere. Check whether state-changing endpoints (`/transfer`, `/request_loan`, `/api/bill-payments/create`) accept a cross-origin request without a CSRF token/SameSite cookie protection.
- [ ] **File upload validation** — `profile.spec.ts` only ever uploads a valid PNG. Extend `fixtures/api/profile.helpers.ts` + `tests/api/profile.spec.ts` to probe:
  - [ ] unrestricted file type (upload `.php`/`.exe`/`.html` disguised as image)
  - [ ] path traversal in filename (`../../etc/passwd` style)
  - [ ] oversized file (no size limit enforcement)
  - [ ] unsafe/collision-prone file naming
- [ ] **Predictable virtual card number generation** — `virtual-cards.spec.ts` tests plaintext exposure but never checks *predictability* the way `bill-payments.spec.ts:769` does for reference numbers. Add a test that creates 2+ cards back-to-back and asserts the card numbers are sequential/derivable (mirror the bill-payment reference-number test pattern).
- [ ] **Rate limiting outside AI chat** — only `ai-chat.spec.ts` tests rate limits. Add brute-force/spam probes for `/login` (auth bruteforce), `/transfer`, and `/request_loan`.

## Medium priority — needs a real assertion, not just a smoke test

- [ ] **Session expiration** — `dashboard.spec.ts:253` ("session timeout gracefully") currently passes on *either* outcome (valid or expired), so it never actually asserts anything. Rewrite to assert a specific expected behavior (e.g., token should/shouldn't still work after N minutes) via `SecurityReporter`.
- [ ] **No server-side token invalidation** — add a test: log out (or otherwise invalidate), then reuse the old token against a protected endpoint and confirm whether it's still accepted.
- [ ] **No transaction/amount ceiling for `/transfer` and `/request_loan`** — only bill-payments has an explicit "no independent ceiling" test (`bill-payments.spec.ts:546`). Mirror it for money-transfer and loans (currently only sign-flip/negative-amount is tested there).
- [ ] **SQL injection in biller selection** — current SQLi probe (`bill-payments.spec.ts:639`) targets `card_id`, not `biller_id`/biller selection itself as the README's Testing Guide describes. Add a direct probe on the biller/category selection parameters.

## Low priority / needs a design decision first

- [ ] **Weak password reset (3-digit PIN) bruteforce** — no test exists; confirm the reset-PIN endpoint still exists in `app.py` before writing a spec.
- [ ] **Token-in-localStorage as a finding** — currently only read incidentally in `create-user.spec.ts` to harvest a token for fixtures, never asserted as a vulnerability. Decide whether this is worth a dedicated `reportWarning`/`reportVulnerability` call (it's inherent to bearer-token SPA design, so may not be worth flagging as a "finding").
- [ ] **Card/balance race conditions** (virtual cards, bill payments, transfers) — intentionally left uncovered because `app.py` runs single-threaded (documented in code comments in `money-transfer.spec.ts:29` and `bill-payments.spec.ts:41`). Revisit only if the app is ever run with `threaded=True` or behind a real WSGI server.
- [ ] **AI: Direct DB access / role override attacks** — not exploitable against the current `LocalAIAgent` stub (echo-only, per `ai-chat.spec.ts` header comment). Revisit if a real LLM-backed agent is reintroduced.

## Documentation fix (not a test gap)

- [ ] **README says "weak JWT implementation" is implemented, but it's fixed.** `auth.py` now derives `JWT_SECRET` from the environment; forged-token tests (`loans.spec.ts:168`, `money-transfer.spec.ts:370`, `ai-chat.spec.ts:217`) already confirm rejection and `reportPass`. Update `README.md` "Implemented Vulnerabilities" → move this (and "Weak secret keys" under Session Management) out of the active list, or add a note like the existing AI-stub caveat.
