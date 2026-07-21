# Performance / load testing (k6)

Load and stress testing against the Vulnerable Bank app, separate from the
Playwright suite in `tests/`. These are k6 scripts (`.js`, run by the `k6`
binary), not Playwright specs — they measure throughput and latency under
concurrent load rather than functional/security correctness.

Scope: auth flows, money movement, and read-heavy dashboard endpoints,
run against a local `docker compose` stack. See `../CLAUDE.md` for the
overall repo conventions this respects (don't "fix" the app's intentional
vulnerabilities; ask-gated files stay untouched).

## Setup

1. Start the target: `docker compose up -d --build` from the repo root.
2. Install k6, either:
   - `brew install k6` (macOS, one-time), or
   - no install — run scripts through Docker instead (see below).
3. Optionally set `BASE_URL` (defaults to `http://localhost:5001`).

### Running via Docker instead of a local k6 install

macOS Docker Desktop doesn't support `--network host` the way Linux does, so
point k6 at the host through Docker's DNS alias instead:

```bash
docker run --rm -i -e BASE_URL=http://host.docker.internal:5001 \
  -v "$PWD/perf:/perf" grafana/k6 run /perf/k6/smoke.js
```

## Running

Always run the smoke test first — it's 1 VU / 1 iteration through every
flow, and will catch a payload-shape mismatch (e.g. after `app.py` changes)
in seconds instead of burying it in a wall of failed checks from a full run.

```bash
k6 run perf/k6/smoke.js
```

Then run a scenario, exporting a summary for later review:

```bash
mkdir -p perf/results
k6 run --summary-export=perf/results/auth.json perf/k6/scenarios/auth.js
k6 run --summary-export=perf/results/money-movement.json perf/k6/scenarios/money-movement.js
k6 run --summary-export=perf/results/dashboard-read.json perf/k6/scenarios/dashboard-read.js
```

Run scenarios one at a time rather than all together the first few times —
it keeps the ramp (see below) attributable to a single flow instead of
mixed load.

## What's being measured, and why it'll likely degrade

- `database.py` initializes `SimpleConnectionPool(min=1, max=10)`. Every
  DB-touching route pulls from that pool. None of the scenarios' ramps stop
  at 10 VUs on purpose — 5 -> 15 -> 30 VUs over ~3 minutes (`perf/k6/lib/config.js`)
  is designed to comfortably exceed the pool size, so you should *expect* to
  see p95 latency climb (or requests start erroring) somewhere around 10
  concurrent DB-touching requests. That's the finding, not a bug to silence.
- None of `/login`, `/register`, `/transfer`, `/api/bill-payments/create`, or
  the read endpoints have any rate limiting (`app.py`'s `ai_rate_limit`
  decorator only wraps the 4 AI-chat routes), so nothing will throttle these
  scripts artificially — any errors you see are the app's real behavior
  under load.
- JWTs never expire (`generate_token` has no `exp` claim), so `lib/auth.js`
  mints tokens once per synthetic user and reuses them for the rest of a run.

To correlate a latency spike with DB pool exhaustion directly while a
scenario is running:

```bash
docker compose exec db psql -U postgres -d vulnerable_bank \
  -c "select count(*) from pg_stat_activity;"
```

## Thresholds

Defined in `perf/k6/lib/config.js`:

- Reads: p95 < 800ms, error rate < 1%
- Writes (register/login/transfer/bill-payment): p95 < 1500ms, error rate < 2%

These document an expected baseline for a healthy run at moderate
concurrency — they are not gates to tune the app to pass at all costs. If a
threshold breaks past ~10 VUs, write that up as a finding.

## Data

Scripts register their own synthetic users (`k6perf-<tag>-<vu>-<iter>-<ts>`)
via `POST /register` and never read or write `test-data/users.json` — that
file is the Playwright suite's shared fixture (`helpers/credentials.ts`) and
mixing k6-generated state into it would corrupt Playwright runs.

## Layout

```
perf/
  k6/
    lib/config.js         BASE_URL, thresholds, ramp stages
    lib/auth.js            register()/login()/registerAndLogin() helpers
    scenarios/auth.js       POST /register, POST /login
    scenarios/money-movement.js   POST /transfer, POST /api/bill-payments/create
    scenarios/dashboard-read.js   GET /check_balance, /transactions, /api/transactions?account_number=, /api/virtual-cards
    smoke.js                1 VU / 1 iteration sanity check across all flows
  results/                 gitignored k6 --summary-export output
```
