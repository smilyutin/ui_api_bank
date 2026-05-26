import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { User } from '../../utils/credentials';
import { buildRegisterFormSubmission } from './register-form.helpers';

export type LoginAttempt = {
  path: string;
  status: number | string;
};

export type LoginFlowResult = {
  loginRes: APIResponse | null;
  successfulLoginPath: string | null;
  attempts: LoginAttempt[];
};

export type LoginFailureAnalysis = {
  category: string;
  description: string;
  recommendations: string[];
};

export type LoginSuccessAnalysis = {
  category: string;
  description: string;
};

const LOGIN_SUCCESS_STATUSES = [200, 201, 302];
const LOGIN_CANDIDATES = ['/api/auth/login', '/api/login', '/login', '/api/session'];

type PayloadVariant = {
  label: string;
  body: Record<string, string>;
};

const recordAttempt = (attempts: LoginAttempt[], path: string, status: number | string) => {
  attempts.push({ path, status });
};

const buildCredentialVariants = (user: User): PayloadVariant[] => {
  const username = user.username || user.email || '';
  const email = user.email || user.username || '';

  return [
    { label: 'username-password', body: { username, password: user.password } },
    { label: 'email-password', body: { email, password: user.password } },
    { label: 'username-email-password', body: { username, email, password: user.password } }
  ];
};

const tryLoginCandidates = async (
  apiContext: APIRequestContext,
  user: User,
  attempts: LoginAttempt[],
  suffix = ''
): Promise<{ loginRes: APIResponse | null; successfulLoginPath: string | null }> => {
  for (const path of LOGIN_CANDIDATES) {
    for (const variant of buildCredentialVariants(user)) {
      const formPath = `${path} (form:${variant.label}${suffix})`;
      try {
        const res = await apiContext.post(path, {
          form: variant.body
        });
        recordAttempt(attempts, formPath, res.status());
        if (LOGIN_SUCCESS_STATUSES.includes(res.status())) {
          return { loginRes: res, successfulLoginPath: formPath };
        }
      } catch (e: any) {
        recordAttempt(attempts, formPath, e?.message || 'error');
      }

      const jsonPath = `${path} (json:${variant.label}${suffix})`;
      try {
        const res = await apiContext.post(path, {
          data: variant.body,
          headers: { 'Content-Type': 'application/json' }
        });
        recordAttempt(attempts, jsonPath, res.status());
        if (LOGIN_SUCCESS_STATUSES.includes(res.status())) {
          return { loginRes: res, successfulLoginPath: jsonPath };
        }
      } catch (e: any) {
        recordAttempt(attempts, jsonPath, e?.message || 'error');
      }
    }
  }

  return { loginRes: null, successfulLoginPath: null };
};

const tryRegisterFallbackThenLogin = async (
  apiContext: APIRequestContext,
  user: User,
  attempts: LoginAttempt[]
): Promise<{ loginRes: APIResponse | null; successfulLoginPath: string | null }> => {
  try {
    const regGet = await apiContext.get('/register');
    recordAttempt(attempts, '/register (get)', regGet.status());
    if (regGet.status() !== 200 || !(regGet.headers()['content-type'] || '').includes('html')) {
      return { loginRes: null, successfulLoginPath: null };
    }

    const html = await regGet.text();
    const { actionPath, formBody } = buildRegisterFormSubmission(html, {
      identifier: user.email || user.username || '',
      email: user.email,
      username: user.username || user.email,
      password: user.password
    });

    try {
      const post = await apiContext.post(actionPath, { form: formBody });
      recordAttempt(attempts, `${actionPath} (register form)`, post.status());
      if (LOGIN_SUCCESS_STATUSES.includes(post.status())) {
        return tryLoginCandidates(apiContext, user, attempts, '-after-register');
      }
    } catch (e: any) {
      recordAttempt(attempts, `${actionPath} (register form)`, e?.message || 'error');
    }

    try {
      const post = await apiContext.post(actionPath, {
        data: buildCredentialVariants(user)[0].body,
        headers: { 'Content-Type': 'application/json' }
      });
      recordAttempt(attempts, `${actionPath} (register json)`, post.status());
      if (LOGIN_SUCCESS_STATUSES.includes(post.status())) {
        return tryLoginCandidates(apiContext, user, attempts, '-after-register');
      }
    } catch (e: any) {
      recordAttempt(attempts, `${actionPath} (register json)`, e?.message || 'error');
    }

    try {
      const post = await apiContext.post(actionPath, {
        data: buildCredentialVariants(user)[2].body,
        headers: { 'Content-Type': 'application/json' }
      });
      recordAttempt(attempts, `${actionPath} (register json:username-email-password)`, post.status());
      if (LOGIN_SUCCESS_STATUSES.includes(post.status())) {
        return tryLoginCandidates(apiContext, user, attempts, '-after-register');
      }
    } catch (e: any) {
      recordAttempt(attempts, `${actionPath} (register json:username-email-password)`, e?.message || 'error');
    }

    return { loginRes: null, successfulLoginPath: null };
  } catch (e: any) {
    recordAttempt(attempts, '/register (get)', e?.message || 'error');
    return { loginRes: null, successfulLoginPath: null };
  }
};

export async function loginViaAvailableFlow(
  apiContext: APIRequestContext,
  user: User
): Promise<LoginFlowResult> {
  const attempts: LoginAttempt[] = [];

  let { loginRes, successfulLoginPath } = await tryLoginCandidates(apiContext, user, attempts);
  if (loginRes) {
    return { loginRes, successfulLoginPath, attempts };
  }

  ({ loginRes, successfulLoginPath } = await tryRegisterFallbackThenLogin(apiContext, user, attempts));
  return { loginRes, successfulLoginPath, attempts };
}

const isNumericStatus = (status: number | string): status is number => typeof status === 'number';

const uniqueNumericStatuses = (attempts: LoginAttempt[]) =>
  [...new Set(attempts.map(({ status }) => status).filter(isNumericStatus))];

const hasPathMatch = (attempts: LoginAttempt[], matcher: RegExp) =>
  attempts.some(({ path }) => matcher.test(path));

export function analyzeLoginFailure(attempts: LoginAttempt[]): LoginFailureAnalysis {
  const statuses = uniqueNumericStatuses(attempts);
  const statusStrings = attempts
    .map(({ status }) => status)
    .filter((status): status is string => typeof status === 'string');

  const hasAuthDenied = statuses.some((status) => status === 401 || status === 403);
  const hasServerError = statuses.some((status) => status >= 500);
  const hasContractMismatch = statuses.some((status) => [400, 405, 415, 422].includes(status));
  const hasOnlyNotFoundStyleStatuses =
    statuses.length > 0 && statuses.every((status) => [404, 405].includes(status));
  const hasTransportError = statusStrings.length > 0;
  const attemptedLoginRoutes = hasPathMatch(attempts, /(login|auth|session)/i);
  const attemptedRegisterRoutes = hasPathMatch(attempts, /register/i);

  if (hasAuthDenied) {
    return {
      category: 'API2:2023 - Broken Authentication',
      description: 'Login endpoints were found, but valid test credentials were rejected by authentication or authorization checks.',
      recommendations: [
        'Verify valid test credentials are accepted consistently across supported login routes.',
        'Return explicit and consistent 401 or 403 responses for rejected authentication attempts.',
        'Review session, cookie, and password verification logic for regressions in the login flow.'
      ]
    };
  }

  if (hasServerError || hasTransportError) {
    return {
      category: 'API8:2023 - Security Misconfiguration',
      description: 'Authentication could not be completed because the login flow encountered server-side or transport-level failures.',
      recommendations: [
        'Review application and proxy logs for failing login requests and resolve the runtime errors.',
        'Ensure authentication routes are enabled consistently in the target environment.',
        'Add a smoke check that confirms the login endpoint is reachable before running the full API test suite.'
      ]
    };
  }

  if (hasContractMismatch && attemptedLoginRoutes) {
    return {
      category: 'API8:2023 - Security Misconfiguration',
      description: 'A login route appears to exist, but it rejects the attempted methods or payload formats, indicating a contract or routing mismatch.',
      recommendations: [
        'Document the accepted login payload shape and content types, and keep form and JSON handling aligned.',
        'Return clear validation or unsupported-media-type responses when login requests are malformed.',
        'Keep implemented authentication contracts synchronized with automated tests and API documentation.'
      ]
    };
  }

  if (hasOnlyNotFoundStyleStatuses || (attemptedLoginRoutes && !attemptedRegisterRoutes)) {
    return {
      category: 'API9:2023 - Improper Inventory Management',
      description: 'No stable, discoverable login endpoint could be exercised successfully through the common authentication routes.',
      recommendations: [
        'Expose and document a stable login endpoint for test and automation environments.',
        'Keep route mappings for authentication consistent across deployments and reverse proxies.',
        'Include the supported login flow in API documentation when an API authentication surface exists.'
      ]
    };
  }

  return {
    category: 'API8:2023 - Security Misconfiguration',
    description: 'Authentication could not be completed because the available login and fallback flows behaved inconsistently.',
    recommendations: [
      'Review the login and registration bootstrap flow end-to-end and remove inconsistent behavior across entry points.',
      'Capture and review failing response bodies for login attempts to identify contract or routing mismatches.',
      'Validate the supported login flow in CI with the same payload formats used by automated tests.'
    ]
  };
}

export function analyzeLoginSuccess(successfulPath: string, status: number): LoginSuccessAnalysis {
  const path = successfulPath.toLowerCase();

  if (path.includes('login') || path.includes('auth') || path.includes('session')) {
    if (path.includes('after-register')) {
      return {
        category: 'API2:2023 - Broken Authentication',
        description: `Authentication succeeded through ${successfulPath} with status ${status} after provisioning a test account through the registration fallback.`
      };
    }

    return {
      category: 'API2:2023 - Broken Authentication',
      description: `Authentication succeeded through ${successfulPath} with status ${status} using valid test credentials.`
    };
  }

  return {
    category: 'API9:2023 - Improper Inventory Management',
    description: `Authentication succeeded through a non-standard path (${successfulPath}) with status ${status}, suggesting the supported login surface is not clearly defined.`
  };
}
