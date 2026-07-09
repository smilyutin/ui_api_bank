# Specs

This is a directory for test plans and feature test-design docs — not to be confused with `tests/`, which
holds the actual executable Playwright spec files (`tests/api/*.spec.ts`, `tests/ui/specs/*.spec.ts`).
A doc here would capture the *plan* behind a feature's test coverage: which endpoints/flows are in scope,
the functional/non-functional/security scenarios to cover (per
`.claude/skills/playwright-vulnerable-bank/SKILL.md`'s Test Design checklist), and known app behavior or
constraints discovered while planning (e.g. rate limits, auth quirks, response-shape gotchas).

This directory is currently empty. When Claude Code plans a feature's test coverage in plan mode, the plan
is written to a session-scoped file under `~/.claude/plans/` on the machine that ran it, not committed to
the repo — that's why past plans for this suite's Loans, Virtual Cards, Bill Payments, Money Transfer, and
AI Customer Support coverage aren't here even though the resulting tests are in `tests/`. If a plan is worth
keeping as durable, version-controlled project history (e.g. to explain *why* a test suite is shaped the
way it is, for future contributors), copy it here as `<feature>.md` rather than leaving it only in a local,
machine-specific plan file.
