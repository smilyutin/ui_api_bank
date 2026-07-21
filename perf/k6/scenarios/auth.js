// Load test for the auth flow itself: POST /register + POST /login.
// Every iteration mints a brand-new user (no rate limiting to worry about),
// so this measures registration and login cost directly rather than reuse.
//
// Run: k6 run --summary-export=perf/results/auth.json perf/k6/scenarios/auth.js

import { sleep } from 'k6';
import { RAMP_STAGES, WRITE_THRESHOLDS } from '../lib/config.js';
import { uniqueCredentials, register, login } from '../lib/auth.js';

export const options = {
  scenarios: {
    auth_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: RAMP_STAGES,
    },
  },
  thresholds: WRITE_THRESHOLDS,
};

export default function () {
  const creds = uniqueCredentials('auth-scenario');
  register(creds);
  login(creds);
  sleep(1);
}
