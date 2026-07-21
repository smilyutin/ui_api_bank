// Sanity check: 1 VU, single iteration through each flow, no thresholds.
// Run this before a real load run to confirm payload shapes still match
// app.py (e.g. after the app image is rebuilt) — a broken script under load
// just produces a wall of failed checks that's harder to read than one
// smoke-test failure.
//
// Run: k6 run perf/k6/smoke.js

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './lib/config.js';
import { uniqueCredentials, register, login, authHeaders } from './lib/auth.js';

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const creds = uniqueCredentials('smoke');

  const registerRes = register(creds);
  check(registerRes, { 'smoke register: 2xx': (r) => r.status >= 200 && r.status < 300 });

  const { token, accountNumber } = login(creds);
  check({ token, accountNumber }, {
    'smoke login: got token': (v) => !!v.token,
    'smoke login: got account number': (v) => !!v.accountNumber,
  });

  const balanceRes = http.get(`${BASE_URL}/check_balance/${accountNumber}`);
  check(balanceRes, { 'smoke check_balance: 200': (r) => r.status === 200 });

  const txRes = http.get(`${BASE_URL}/transactions/${accountNumber}`);
  check(txRes, { 'smoke transactions: 200': (r) => r.status === 200 });

  const apiTxRes = http.get(`${BASE_URL}/api/transactions?account_number=${accountNumber}`, authHeaders(token));
  check(apiTxRes, { 'smoke api/transactions: 200': (r) => r.status === 200 });

  const transferRes = http.post(
    `${BASE_URL}/transfer`,
    JSON.stringify({ to_account: accountNumber, amount: 1, description: 'k6 smoke self-transfer' }),
    authHeaders(token)
  );
  check(transferRes, { 'smoke transfer: 2xx': (r) => r.status >= 200 && r.status < 300 });

  const categoriesRes = http.get(`${BASE_URL}/api/bill-categories`);
  check(categoriesRes, { 'smoke bill-categories: 200': (r) => r.status === 200 });
}
