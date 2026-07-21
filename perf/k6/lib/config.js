// Shared config for all k6 scenarios. Import with:
//   import { BASE_URL, READ_THRESHOLDS, WRITE_THRESHOLDS } from '../lib/config.js';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';

// Reads (no DB write, no auth on most): tighter latency budget.
export const READ_THRESHOLDS = {
  http_req_duration: ['p(95)<800'],
  http_req_failed: ['rate<0.01'],
};

// Writes (login/register/transfer/bill-payment): looser budget, these go
// through the connection pool (database.py: SimpleConnectionPool max=10).
export const WRITE_THRESHOLDS = {
  http_req_duration: ['p(95)<1500'],
  http_req_failed: ['rate<0.02'],
};

// Conservative ramp: 30 VUs already exceeds the DB pool size of 10, which is
// the point — we want to see queuing/latency rise past that, not bury it
// under CPU contention from an even bigger ramp.
export const RAMP_STAGES = [
  { duration: '30s', target: 5 },
  { duration: '1m', target: 15 },
  { duration: '1m', target: 30 },
  { duration: '30s', target: 0 },
];
