# Self-Optimizing Agents

How the Planner → Generator → Healer Playwright agents in this directory work together, and how to add or modify one. This repo already implements the pattern below as three concrete agents — this doc explains how they fit, it doesn't propose a new design.

## Goals
- Continuous improvement: the Healer learns from real failure signals (`test_run`/`test_debug` output), not guesses.
- Safe automation: generated/healed specs still have to meet this repo's own conventions before merging (see "Relationship to this repo's test conventions" below).
- Fast feedback: one scenario per Generator run, one failing test at a time in the Healer, small diffs.

## Pipeline (the three real agents)

| Stage | File | Does |
|---|---|---|
| **Plan** | `playwright-test-planner.agent.md` | Explores the live app via `browser_*` MCP tools, writes a markdown test plan (happy path + edge cases + negative scenarios) via `planner_save_plan`. |
| **Generate** | `playwright-test-generator.agent.md` | Takes one scenario from a plan, executes each step live via `browser_*` tools, reads the run via `generator_read_log`, writes a single spec via `generator_write_test`. |
| **Heal** | `playwright-test-healer.agent.md` | Runs the suite (`test_run`), debugs one failing test at a time (`test_debug`), fixes root cause, re-verifies, escalates to `test.fixme()` after 3 failed attempts. |

There's no separate Logger/Synthesizer/Optimizer component to build — logging and synthesis happen inside the Generator's single pass, and the "optimization loop" is just the Healer's iterate-until-green-or-fixme cycle (see below). Don't add new agent files for these; extend the existing three.

## Relationship to this repo's test conventions

These agents drive the live app directly through MCP browser tool calls (`browser_click`, `browser_snapshot`, …), which by itself knows nothing about this repo's Page Object Model, `PageManager`, `SecurityReporter`, or schema validation (`CLAUDE.md`, `.claude/skills/playwright-vulnerable-bank/SKILL.md`). All three agents carry the `search` tool specifically so they can check for and apply those conventions before writing/fixing code — each `.agent.md` file has an explicit instruction block for this (Planner: prioritize gaps from `TODO.md`/`TESTPLAN.md`; Generator: reuse `PageManager`/page objects, `validateSchema()`, `SecurityReporter` when they apply; Healer: fix root causes without stripping that structure back out). Still review the output — "instructed to" isn't "guaranteed to"; a Generator/Healer-touched spec is a draft until a human confirms it actually followed the convention rather than just not breaking syntactically.

## MCP tool naming

Copilot agent frontmatter declares tools as `<mcp-server-name>/<tool-name>` — slash-separated, matching the `mcp-servers.playwright-test` block in each `.agent.md` file, e.g. `playwright-test/browser_click`, `playwright-test/generator_write_test`. Copy the exact tool name from an existing agent file rather than retyping it; this naming has nothing to do with (and doesn't need to match) this repo's own TypeScript file/identifier conventions.

## Agent Markdown Template

Minimal real frontmatter an agent needs to reach the Playwright MCP test server:

```yaml
---
name: my-new-agent
description: One sentence — when this agent should be invoked.
tools:
  - search
  - playwright-test/browser_click
  - playwright-test/browser_snapshot
  # ...only the tools this agent actually needs
model: Claude Sonnet 4.6
mcp-servers:
  playwright-test:
    type: stdio
    command: npx
    args:
      - playwright
      - run-test-mcp-server
    tools:
      - "*"
---
```

Follow the frontmatter with plain-language behavior rules as a **sequential, numbered workflow** with explicit handling for missing input, tool failures, and edge cases — see any of the three existing `.agent.md` files for the expected level of precision; a goals list alone (as this section used to show) isn't enough for the agent to run unattended.

## Optimization Loop (Healer)

1. `test_run` to find failures. Zero failures → stop, report all-green.
2. `test_debug` one failing test — don't start another until this one is fixed or marked `test.fixme()`.
3. Diagnose root cause (stale selector, timing, changed app behavior, bad assertion) and fix with a minimal diff.
4. Re-run the same test to verify the fix.
5. After 3 distinct fix attempts on one test, stop, mark `test.fixme()` with a comment on observed-vs-expected behavior, and move to the next failing test.
6. If a failure is caused by an unreachable service/URL (not the test), don't edit the test — mark `test.fixme()` noting the infrastructure dependency instead.

## GitHub Actions

Real workflows in this repo: `.github/workflows/playwright.yml` (build the Docker stack, poll `:5001` until ready, `npm test`, upload the HTML report) and `.github/workflows/copilot-setup-steps.yml` (Copilot's own environment bootstrap — `npm ci` + `playwright install --with-deps`). There is no `security.yml` and no `tests/security/` directory — that folder was retired during the test-suite rebuild (see `README.md`'s project-structure note); security assertions live inline in `tests/api/*.spec.ts` via `SecurityReporter`, not a separate workflow or directory.

- Keep `on:` triggers enabled; to suspend a workflow temporarily, use branch filters — don't comment out `on:`.
- Artifacts (HTML report, `test-results/`) already upload unconditionally in `playwright.yml`; don't add more unless debugging a specific flake.

## Quick Start

### Local
```bash
npm ci
npx playwright install --with-deps
docker compose up -d --build
BASE_URL=http://localhost:5001 npm test
```

### CI
See `.github/workflows/playwright.yml` and `.github/workflows/copilot-setup-steps.yml`. Both expect `on:` present and correctly indented — a malformed `on:` block silently disables the workflow.

## Best Practices
- Prefer small, focused patches — one test, one fix, re-verify (this is literally the Healer's loop above).
- Use resilient locators (roles, test ids, regex for dynamic data); brittle text-only matches are the most common thing the Healer ends up fixing.
- Tie waits to a specific element or URL, never `networkidle` — the dashboard fires background fetches after load that never let it settle (see SKILL.md's readiness-check pattern).
- Don't add CI artifact uploads beyond what `playwright.yml` already does unconditionally.
