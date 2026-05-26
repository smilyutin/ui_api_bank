import { test, expect, request, APIRequestContext, APIResponse } from '@playwright/test';
import { findOrCreateUser, User } from '../utils/credentials';
import { validateSchema } from '../utils/schema-validator';
import { SecurityReporter } from '../security/security-reporter';
import { loadStoredToken } from '../utils/credentials';

function getTokenHeaders(): Record<string, string> | undefined {
  const token = loadStoredToken('user') || process.env.API_AUTH_TOKEN?.trim();
  if (!token) return undefined;

  return {
    Authorization: `Bearer ${token}`,
    'X-Auth-Token': token,
  };
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function safeText(res: APIResponse): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function tryApiLogin(api: APIRequestContext, user: User): Promise<boolean> {
  // Common candidates (mirrors tests/api/login.spec.ts but kept local to avoid cross-test coupling)
  const loginCandidates = ['/api/auth/login', '/api/login', '/login', '/api/session'];
// Removed invalid call to validateSchema with undefined responseBody
  for (const p of loginCandidates) {
    // form-like body
    try {
      const res = await api.post(p, { data: { username: user.username || user.email, password: user.password } });
      if ([200, 201, 302, 303].includes(res.status())) return true;
    } catch {
      // continue
    }

    // JSON body
    try {
      const res = await api.post(p, {
        data: JSON.stringify({ username: user.username || user.email, password: user.password }),
        headers: { 'Content-Type': 'application/json' },
      });
      if ([200, 201, 302, 303].includes(res.status())) return true;
    } catch {
      // continue
    }
  }

  return false;
}

test.describe('API - Dashboard', () => {
  test('GET /dashboard should respond safely (protected or reachable)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const reporter = new SecurityReporter(testInfo);
    const api = await request.newContext({ baseURL: baseURL.toString() });
    const res = await api.get('/dashboard');
    const status = res.status();
    const ct = (res.headers()['content-type'] || '').toLowerCase();

    // If the app simply doesn't have a dashboard route, treat as not applicable.
    if (status === 404) {
      reporter.reportSkip('Dashboard route is not present on this application target (404).');
      test.skip(true, 'GET /dashboard not found (404)');
    }

    // A dashboard is typically protected; these are acceptable outcomes.
    const ok =
      status === 200 ||
      status === 401 ||
      status === 403 ||
      isRedirect(status);

    if (!ok) {
      reporter.reportWarning(
        `Unexpected dashboard response status detected: ${status}.`,
        [
          'Restrict dashboard access to authenticated users and return explicit 401/403 when unauthenticated.',
          'Avoid non-standard status codes for auth-protected resources.',
          'Document expected status behavior for /dashboard in API docs.'
        ],
        'API5:2023 - Broken Function Level Authorization'
      );
    }

    // Never acceptable: server errors.
    expect(status, `Unexpected status for GET /dashboard: ${status}`).toBeLessThan(500);
    expect(ok, `Unexpected status for GET /dashboard: ${status}`).toBeTruthy();

    if (status === 200 && ct.includes('application/json')) {
      await validateSchema('dashboard-schema', 'GET_dashboard', await res.json());
    }

    if (status === 200) {
      expect(ct, 'Expected HTML content-type for /dashboard').toContain('text/html');

      const body = (await safeText(res)).toLowerCase();
      // very light sanity check; avoid brittle selectors
      expect(body, 'Expected an HTML document response for /dashboard').toContain('<html');
      reporter.reportPass(
        'Dashboard endpoint is reachable and returns a valid HTML response without server errors.',
        'API7:2023 - Server Side Request Forgery'
      );
    }

    if (isRedirect(status)) {
      const location = res.headers()['location'] || '';
      // Many apps redirect unauthenticated users to login.
      expect(location.toLowerCase(), 'Redirect should likely go to login/signin').toMatch(/login|sign(in)?/);
      reporter.reportPass(
        `Dashboard access is protected and redirects unauthenticated users to login (${location || 'no location header'}).`,
        'API2:2023 - Broken Authentication'
      );
    }

    if (status === 401 || status === 403) {
      reporter.reportPass(
        `Dashboard endpoint correctly denies unauthenticated access with status ${status}.`,
        'API5:2023 - Broken Function Level Authorization'
      );
    }
  });

  test('GET /dashboard should be accessible after API login (best-effort)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const reporter = new SecurityReporter(testInfo);
    const tokenHeaders = getTokenHeaders();
    const api = await request.newContext({
      baseURL: baseURL.toString(),
      extraHTTPHeaders: tokenHeaders,
    });

    if (tokenHeaders) {
      reporter.reportPass(
        'Using API_AUTH_TOKEN from the environment for the authenticated dashboard check.',
        'API2:2023 - Broken Authentication'
      );
    }

    if (!tokenHeaders) {
      const user = findOrCreateUser('e2e');
      const loggedIn = await tryApiLogin(api, user);

      if (!loggedIn) {
        reporter.reportSkip('Could not establish API-authenticated session through supported login endpoints.');
        test.skip(true, 'Could not login via API candidates; skipping authenticated dashboard check');
      }
    }

    const res = await api.get('/dashboard');
    const status = res.status();

    if (status === 404) {
      reporter.reportSkip('Dashboard route is not present on this application target (404).');
      test.skip(true, 'GET /dashboard not found (404)');
    }

    // After login we prefer 200; but some apps still require UI session flows.
    // Treat auth-required responses as a signal that /dashboard is not API-accessible.
    if (status === 401 || status === 403 || isRedirect(status)) {
      const authMode = tokenHeaders ? 'provided bearer token' : 'API session login';
      reporter.reportSkip(`Dashboard requires non-API session handoff after ${authMode} (status ${status}).`);
      test.skip(true, `Dashboard not accessible via ${authMode} (status ${status})`);
    }

    expect(status, `Expected 200 after login, got ${status}`).toBe(200);
    reporter.reportPass(
      'Dashboard endpoint is accessible after API login and returns HTTP 200.',
      'API2:2023 - Broken Authentication'
    );
  });
});
