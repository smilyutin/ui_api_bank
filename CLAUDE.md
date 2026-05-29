# Claude Code orchestrator

- Keep Playwright readiness checks UI-based; avoid `networkidle` for dashboard flows.
- Prefer shared helpers in `helpers/`, reusable pages in `pages/`, and endpoint discovery in `fixtures/api/`.
- Use `test-data/` for persisted fixtures like shared users and tokens.
- Keep security-oriented reporting in `fixtures/helper/` and test-only utilities in `tests/`.
