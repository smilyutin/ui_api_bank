# Scripts

Place setup and utility scripts here for local automation or CI helpers — e.g. one-off data seeding/reset
scripts for the Vulnerable Bank Postgres DB, or a schema-generation script for `response-schemas/`.

This directory is currently empty. The closest existing equivalent to a "regenerate schema" script is
built directly into the test suite rather than living here: `helpers/schema-validator.ts`'s
`UPDATE_SCHEMAS=1` env var (see `CLAUDE.md`'s "Schema validation" section) regenerates a mismatched or
missing `response-schemas/<dir>/<file>.json` from a live response the next time its owning test runs —
e.g. `UPDATE_SCHEMAS=1 BASE_URL=http://localhost:5001 npx playwright test tests/api/<file>.spec.ts`.

If a standalone script becomes useful (e.g. bulk-regenerating every schema in one pass without running the
full suite, or a DB reset/seed helper for local dev), add it here with a short usage comment at the top and
a line in this README describing what it does and when to reach for it instead of the in-test workflow.
