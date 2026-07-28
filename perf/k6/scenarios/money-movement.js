// Load test for money movement: POST /transfer and POST /api/bill-payments/create.
//
// setup() pre-registers a pool of synthetic users (so per-iteration cost is
// just the transfer/payment call, not registration+login) and discovers a
// real biller_id via the public /api/bill-categories + /api/billers/by-category
// catalog rather than hardcoding a seed id that may not be stable.
//
// Run: k6 run --summary-export=perf/results/money-movement.json perf/k6/scenarios/money-movement.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, RAMP_STAGES, WRITE_THRESHOLDS } from '../lib/config.js';
import { registerAndLogin, authHeaders } from '../lib/auth.js';

const POOL_SIZE = 30;

export const options = {
  scenarios: {
    money_movement_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: RAMP_STAGES,
    },
  },
  thresholds: WRITE_THRESHOLDS,
};

export function setup() {
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    pool.push(registerAndLogin(`money-pool-${i}`));
  }

  let billerId = null;
  const categoriesRes = http.get(`${BASE_URL}/api/bill-categories`);
  const categories = categoriesRes.json('categories') || [];
  if (categories.length > 0) {
    const billersRes = http.get(`${BASE_URL}/api/billers/by-category/${categories[0].id}`);
    const billers = billersRes.json('billers') || [];
    if (billers.length > 0) billerId = billers[0].id;
  }

  return { pool, billerId };
}

export default function (data) {
  const { pool, billerId } = data;
  const from = pool[__VU % pool.length];
  const to = pool[(__VU + 1) % pool.length];

  const transferRes = http.post(
    `${BASE_URL}/transfer`,
    JSON.stringify({ to_account: to.accountNumber, amount: 1, description: 'k6 perf transfer' }),
    authHeaders(from.token)
  );
  check(transferRes, { 'transfer: 2xx': (r) => r.status >= 200 && r.status < 300 });

  if (billerId) {
    const billRes = http.post(
      `${BASE_URL}/api/bill-payments/create`,
      JSON.stringify({ biller_id: billerId, amount: 1, payment_method: 'balance' }),
      authHeaders(from.token)
    );
    check(billRes, { 'bill-payment: 2xx': (r) => r.status >= 200 && r.status < 300 });
  }

  sleep(0.2);
}
