---
name: framework-onboarding
description: Use when adding automation support for a new test framework or workflow to this repo (beyond the existing Playwright and Appium suites) — walks through identifying the workflow, drafting the skill with AI assistance, and integrating/refining it so it matches the conventions of the existing skills.
---

# Onboarding a New Automation Framework

This repo already has two framework skills — `.claude/skills/playwright-vulnerable-bank/SKILL.md` (UI + API automation) and `.claude/skills/appium-mobile-bank/SKILL.md` (mobile-web automation). Both were built the same way. Use this same process for the next one (e.g. a Cypress suite, a k6 performance suite, a Selenium/Java suite, a contract-test suite).

## 1. Identify a workflow to automate

Before writing anything, pin down:

- **What surface is being tested** — UI, API, mobile, performance, contract, etc. — and why the existing suites don't already cover it (different protocol/engine, different language, different target environment).
- **What tool/framework drives it** — the actual library (e.g. Cypress, k6, WebdriverIO, REST Assured) and why it's the right fit for this surface.
- **What already exists to model conventions on** — read both existing SKILL.md files first. Reuse their structure (Project Layout, conventions, workflows, checklist) rather than inventing a new shape.
- **Where it lives in the repo** — a new top-level directory analogous to `tests/`/`pages/`/`fixtures/` (Playwright) or `mobile/` (Appium), kept separate from the others so tooling/tsconfig/deps don't leak between suites (see how `mobile/tsconfig.json` is deliberately separate from the repo root one, for example).

## 2. Implement a skill

Ask Claude Code for assistance drafting the skill once the above is settled — don't hand-write it from scratch. Give it:

- The target framework and the workflow scope from step 1.
- Both existing SKILL.md files as structural references.
- Any early code/config you've already written for the new suite (configs, one example test/page object) so the skill documents real conventions, not guesses.

The resulting `SKILL.md` should live at `.claude/skills/<framework-name>-<scope>/SKILL.md` (kebab-case directory, matching `playwright-vulnerable-bank` / `appium-mobile-bank`) with:

```markdown
---
name: <kebab-case-matching-directory>
description: <one line: what this skill is for and when to use it>
---

# <Human title>

<1-2 paragraph intro: what this suite tests, what tool it uses, how it relates to the sibling suites>

## Project Layout

<directory tree with one-line annotations per path, mirroring the existing two skills>

## Conventions
## Workflows (e.g. adding a new test, adding a new page object/fixture)
## Feature checklist (if applicable)
```

## 3. Integrate and refine skill

- Add a one-line pointer to the new skill from `CLAUDE.md`'s "Project overview" and "Test suite architecture" sections (see how it currently links to both existing skills) — don't duplicate detail there, just point at the skill.
- Update `.claude/settings.json`'s allow/ask lists if the new suite introduces new paths that should be freely editable (mirror the existing `tests/**`, `pages/**`, etc. entries) or new prod-adjacent files that need `ask`.
- If the new suite needs its own CI job, follow the pattern of the `mobile-android` and `performance` jobs in `.github/workflows/playwright.yml` — gated by `dorny/paths-filter` on the new suite's directory so unrelated changes don't pay for it.
- Run the new suite end-to-end at least once, then revisit the skill: fix anything the dry run revealed as wrong, missing, or over-specified. A skill is done when someone (or Claude) can follow it cold and produce a test that matches the rest of the suite's conventions on the first try.
