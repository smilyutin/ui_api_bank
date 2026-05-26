import type { Page } from '@playwright/test';
import { request } from '@playwright/test';
import { LoginPage } from '../page-objects/login.page';
import { DashboardPage } from '../page-objects/dashboard.page';
import { findOrCreateUser, loadStoredToken, saveStoredToken } from '../../utils/credentials';

const TOKEN_STORAGE_KEYS = ['token', 'jwt', 'jwt_token', 'auth', 'access_token', 'id_token'];
const TOKEN_COOKIE_NAMES = ['token', 'jwt', 'access_token', 'auth_token'];
const LOGIN_CANDIDATES = ['/api/auth/login', '/api/login', '/login', '/api/session'];
const LOGIN_SUCCESS_STATUSES = [200, 201, 302, 303];

export type UiAuthRole = 'user' | 'admin';

export type DashboardAuthResult = {
  mode: 'token' | 'credentials';
  role: UiAuthRole;
  identifier: string;
  expectedIdentifiers: string[];
};

type TokenAuthContext = {
  token: string;
  identifier: string | null;
};

function getTokenByRole(role: UiAuthRole): string | null {
  if (role === 'admin') {
    return loadStoredToken('admin') || process.env.ADMIN_AUTH_TOKEN?.trim() || null;
  }
  return loadStoredToken('user') || process.env.API_AUTH_TOKEN?.trim() || null;
}

function extractCookieToken(setCookieHeader: string): string | null {
  const parts = String(setCookieHeader).split(/,(?=\s*[^\s]+=)/);
  for (const part of parts) {
    for (const name of TOKEN_COOKIE_NAMES) {
      const match = part.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
  }
  return null;
}

async function extractTokenFromResponse(res: any): Promise<string | null> {
  try {
    const json = await res.json().catch(() => null);
    const bodyToken =
      json?.token ||
      json?.jwt_token ||
      json?.jwt ||
      json?.access_token ||
      json?.id_token ||
      null;
    if (bodyToken) return String(bodyToken);
  } catch {
    // ignore
  }

  const authHeader = res.headers()['authorization'];
  if (authHeader) {
    const maybe = String(authHeader).split(' ').pop();
    if (maybe) return maybe;
  }

  const setCookie = res.headers()['set-cookie'];
  if (setCookie) {
    const cookieToken = extractCookieToken(setCookie);
    if (cookieToken) return cookieToken;
  }

  return null;
}

async function mintFreshUserToken(
  baseURL: string,
  fallbackUserPrefix: string
): Promise<{ token: string; identifier: string } | null> {
  const user = findOrCreateUser(fallbackUserPrefix);
  const identifier = user.username || user.email;
  if (!identifier) return null;

  const variants = [
    { username: identifier, password: user.password } as Record<string, string>,
    { email: identifier, password: user.password } as Record<string, string>,
    {
      username: user.username || identifier,
      email: user.email || identifier,
      password: user.password,
    } as Record<string, string>,
  ];

  const api = await request.newContext({ baseURL });
  try {
    for (const path of LOGIN_CANDIDATES) {
      for (const payload of variants) {
        try {
          const jsonRes = await api.post(path, {
            data: payload,
            headers: { 'Content-Type': 'application/json' },
          });
          if (LOGIN_SUCCESS_STATUSES.includes(jsonRes.status())) {
            const token = await extractTokenFromResponse(jsonRes);
            if (token) return { token, identifier };
          }
        } catch {
          // continue
        }

        try {
          const formRes = await api.post(path, { form: payload });
          if (LOGIN_SUCCESS_STATUSES.includes(formRes.status())) {
            const token = await extractTokenFromResponse(formRes);
            if (token) return { token, identifier };
          }
        } catch {
          // continue
        }
      }
    }
  } finally {
    await api.dispose();
  }

  return null;
}

function decodeTokenIdentifier(token: string): string | null {
  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) return null;

    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      username?: string;
      email?: string;
      sub?: string;
    };

    return payload.username || payload.email || payload.sub || null;
  } catch {
    return null;
  }
}

function getTokenAuthContext(role: UiAuthRole): TokenAuthContext | null {
  const token = getTokenByRole(role);
  if (!token) return null;
  return {
    token,
    identifier: decodeTokenIdentifier(token),
  };
}

async function applyTokenBootstrap(page: Page, baseURL: string, token: string) {
  // Navigate to establish origin, then set storage for that origin only.
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate(
    ({ injectedToken, keys }) => {
      for (const key of keys) {
        window.localStorage.setItem(key, injectedToken);
        window.sessionStorage.setItem(key, injectedToken);
      }
    },
    { injectedToken: token, keys: TOKEN_STORAGE_KEYS }
  ).catch(() => {});

  await page.context().addCookies(
    TOKEN_COOKIE_NAMES.map((name) => ({
      name,
      value: token,
      url: baseURL,
      sameSite: 'Lax' as const,
      secure: baseURL.startsWith('https://'),
    }))
  );

  return {
    clear: async () => {
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page
        .evaluate(
          ({ keys }) => {
            for (const key of keys) {
              window.localStorage.removeItem(key);
              window.sessionStorage.removeItem(key);
            }
          },
          { keys: TOKEN_STORAGE_KEYS }
        )
        .catch(() => {});
      await page.context().clearCookies().catch(() => {});
    },
  };
}

function getAdminCredentialsFromEnv(): { identifier: string; password: string } | null {
  const identifier =
    process.env.ADMIN_USERNAME?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.ADMIN_IDENTIFIER?.trim() ||
    '';
  const password = process.env.ADMIN_PASSWORD?.trim() || '';

  if (!identifier || !password) return null;
  return { identifier, password };
}

export async function ensureDashboardAuthenticated(
  page: Page,
  options: {
    baseURL: string;
    role?: UiAuthRole;
    fallbackUserPrefix?: string;
    requireToken?: boolean;
  }
): Promise<DashboardAuthResult> {
  const role = options.role || 'user';
  const baseURL = options.baseURL;
  const fallbackUserPrefix = options.fallbackUserPrefix || (role === 'admin' ? 'ADMIN' : 'e2e');
  const requireToken = options.requireToken === true;
  const dash = new DashboardPage(page);

  const expectedIdentifiers: string[] = [];
  let tokenAuth = getTokenAuthContext(role);

  if (!tokenAuth && role === 'user') {
    const minted = await mintFreshUserToken(baseURL, fallbackUserPrefix);
    if (minted?.token) {
      process.env.API_AUTH_TOKEN = minted.token;
      saveStoredToken(minted.token, 'user');
      tokenAuth = { token: minted.token, identifier: minted.identifier };
    }
  }

  if (requireToken && !tokenAuth) {
    throw new Error('Token is required for this test, but no token is available or could be minted.');
  }

  if (tokenAuth?.identifier) {
    expectedIdentifiers.push(tokenAuth.identifier);
  }

  if (tokenAuth) {
    const bootstrap = await applyTokenBootstrap(page, baseURL, tokenAuth.token);
    await dash.goto(baseURL);
    try {
      await dash.waitForLoad();
      const identifier = tokenAuth.identifier || `${role}-token-user`;
      if (!expectedIdentifiers.includes(identifier)) {
        expectedIdentifiers.push(identifier);
      }
      return {
        mode: 'token',
        role,
        identifier,
        expectedIdentifiers,
      };
    } catch {
      await bootstrap.clear();

      if (role === 'user') {
        const refreshed = await mintFreshUserToken(baseURL, fallbackUserPrefix);
        if (refreshed?.token) {
          process.env.API_AUTH_TOKEN = refreshed.token;
          saveStoredToken(refreshed.token, 'user');
          const retryBootstrap = await applyTokenBootstrap(page, baseURL, refreshed.token);
          await dash.goto(baseURL);
          try {
            await dash.waitForLoad();
            if (!expectedIdentifiers.includes(refreshed.identifier)) {
              expectedIdentifiers.push(refreshed.identifier);
            }
            return {
              mode: 'token',
              role,
              identifier: refreshed.identifier,
              expectedIdentifiers,
            };
          } catch {
            await retryBootstrap.clear();
          }
        }
      }

      if (requireToken) {
        throw new Error('Token authentication was required but token bootstrap failed.');
      }

      // Fall back to credential login when token bootstrap is not sufficient for this app.
    }
  }

  const login = new LoginPage(page);
  await login.goto(baseURL);

  let identifier = '';
  let password = '';

  if (role === 'admin') {
    const adminCreds = getAdminCredentialsFromEnv();
    if (!adminCreds) {
      throw new Error(
        'Admin UI auth fallback requires ADMIN_AUTH_TOKEN or ADMIN_USERNAME/ADMIN_EMAIL + ADMIN_PASSWORD in .env'
      );
    }
    identifier = adminCreds.identifier;
    password = adminCreds.password;
  } else {
    const user = findOrCreateUser(fallbackUserPrefix);
    const foundIdentifier = user.username || user.email;
    if (!foundIdentifier) {
      throw new Error('No username or email found in user credentials');
    }
    identifier = foundIdentifier;
    password = user.password;
  }

  await login.fillEmail(identifier);
  await login.fillPassword(password);
  await login.submit();

  await dash.waitForLoad();
  expectedIdentifiers.push(identifier);

  if (requireToken) {
    throw new Error('Token authentication was required but test reached credential fallback.');
  }

  return {
    mode: 'credentials',
    role,
    identifier,
    expectedIdentifiers,
  };
}