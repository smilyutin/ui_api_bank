// Registration/login helpers matching the real payload shapes in app.py.
//
// POST /register -> JSON { username, password }
//   response.debug_data.account_number holds the new account number
//   (top-level response has no account_number field).
// POST /login -> JSON { username, password }
//   response.token / response.accountNumber / response.isAdmin
//
// Neither endpoint is rate limited (app.py's ai_rate_limit only wraps the
// AI-chat routes) and JWTs never expire (no `exp` claim in generate_token),
// so one token minted in setup() is safe to reuse for an entire run.

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './config.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// __VU/__ITER are only defined while a VU is executing a scenario function —
// referencing them from setup() (e.g. when pre-registering a pool of users)
// throws a ReferenceError, so fall back to Math.random() there instead.
export function uniqueCredentials(tag) {
  const vu = typeof __VU !== 'undefined' ? __VU : 'setup';
  const iter = typeof __ITER !== 'undefined' ? __ITER : Math.floor(Math.random() * 1e6);
  const suffix = `${tag}-${vu}-${iter}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return {
    username: `k6perf-${suffix}`,
    password: 'K6PerfTest123!',
  };
}

export function register(creds) {
  const res = http.post(`${BASE_URL}/register`, JSON.stringify(creds), { headers: JSON_HEADERS });
  check(res, { 'register: 2xx': (r) => r.status >= 200 && r.status < 300 });
  return res;
}

export function login(creds) {
  const res = http.post(`${BASE_URL}/login`, JSON.stringify(creds), { headers: JSON_HEADERS });
  check(res, { 'login: 200': (r) => r.status === 200 });

  let body = null;
  let token = null;
  let accountNumber = null;

  try {
    body = res.json();
    token = body?.token || null;
    accountNumber = body?.accountNumber || null;
  } catch (e) {
    check(false, { 'login: JSON parse error': () => false });
  }

  return {
    res,
    token,
    accountNumber,
  };
}

// Registers a fresh synthetic user and logs in immediately, returning a
// ready-to-use auth context. Used from scenario setup() stages so VUs don't
// pay registration cost mid-run (except in scenarios/auth.js, which is
// deliberately measuring registration/login themselves).
export function registerAndLogin(tag) {
  const creds = uniqueCredentials(tag);
  register(creds);
  const { token, accountNumber } = login(creds);
  return { token, accountNumber, creds };
}

export function authHeaders(token) {
  return { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } };
}
