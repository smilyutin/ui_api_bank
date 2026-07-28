// Load test for read-heavy endpoints: balance/transaction lookups and the
// authenticated transactions/virtual-cards APIs. setup() mints one shared
// user so every VU reads the same account — these routes are intentionally
// unauthenticated (BOLA) or idempotent GETs, so sharing is fine and keeps
// this scenario purely about read latency, not write contention.
//
// Run: k6 run --summary-export=perf/results/dashboard-read.json perf/k6/scenarios/dashboard-read.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, RAMP_STAGES, READ_THRESHOLDS } from '../lib/config.js';
import { registerAndLogin, authHeaders } from '../lib/auth.js';

export const options = {
  scenarios: {
    dashboard_read_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: RAMP_STAGES,
    },
  },
  thresholds: READ_THRESHOLDS,
};

export function setup() {
  return registerAndLogin('dashboard-read');
}

export default function (data) {
  const { token, accountNumber } = data;

  const balanceRes = http.get(`${BASE_URL}/check_balance/${accountNumber}`);
  check(balanceRes, { 'check_balance: 200': (r) => r.status === 200 });

  const txRes = http.get(`${BASE_URL}/transactions/${accountNumber}`);
  check(txRes, { 'transactions: 200': (r) => r.status === 200 });

  const apiTxRes = http.get(`${BASE_URL}/api/transactions?account_number=${accountNumber}`, authHeaders(token));
  check(apiTxRes, { 'api/transactions: 200': (r) => r.status === 200 });

  const cardsRes = http.get(`${BASE_URL}/api/virtual-cards`, authHeaders(token));
  check(cardsRes, { 'api/virtual-cards: 200': (r) => r.status === 200 });

  sleep(0.2);
}
