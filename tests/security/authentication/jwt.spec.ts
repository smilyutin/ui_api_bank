import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { decodeJwtNoVerify, buildNoneAlgToken } from '../sec-objects/authentication/jwt.logic';

/**
 * Authentication - JWT claims and algorithm handling
 *
 * auth.py's `generate_token()` comment says "Missing 'exp' claim - tokens
 * never expire" and `ALGORITHMS = ['HS256', 'none']` says "Vulnerable
 * algorithm selection - allows 'none' algorithm". Both are checked directly
 * against a live token rather than trusting the comments:
 *
 * - No-expiration is confirmed real: a decoded token has no `exp` field.
 * - The `alg: none` bypass is NOT actually exploitable with this app's
 *   PyJWT version (2.13.0) — `jwt.decode(token, JWT_SECRET, algorithms=[...])`
 *   raises `InvalidKeyError: When alg = "none", key value must be None`
 *   because verify_token() always passes the real secret as the key
 *   regardless of the token's claimed algorithm (confirmed by reproducing
 *   auth.py's exact decode call locally, and by hitting a real protected
 *   endpoint with a forged none-alg token — both reject it).
 */
test.describe('@security  Authentication - JWT', () => {
  test('an issued token should carry an expiration claim', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'jwt-exp');
    await api.dispose();
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      test.skip(true, 'No account session available');
      return;
    }

    const decoded = await test.step('Decode the issued JWT', async () => {
      const decoded = decodeJwtNoVerify(session.token);
      testInfo.attach('jwt-claims-probe', { body: JSON.stringify(decoded, null, 2), contentType: 'application/json' });
      return decoded;
    });

    await test.step('Verify it carries an expiration claim', async () => {
      const hasExp = !!decoded?.payload && 'exp' in decoded.payload;

      if (!hasExp) {
        reporter.reportVulnerability(
          'API2_AUTH',
          { header: decoded?.header, payload: decoded?.payload, issue: 'Token payload has no exp claim' },
          [
            'Add an exp claim to every issued token (e.g. 15-60 minutes for access tokens).',
            'Implement refresh tokens for longer-lived sessions instead of a single never-expiring token.',
            'Reject and refuse to renew tokens once expired, verified server-side on every request.'
          ]
        );
      } else {
        reporter.reportPass('Issued token includes an exp claim.', 'API2:2023 - Broken Authentication');
      }
    });
  });

  test('a forged alg:none token should not be accepted as valid authentication', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'jwt-none-alg');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { forgedPayload, status } = await test.step('Forge an alg:none token and attempt to authenticate', async () => {
      const decoded = decodeJwtNoVerify(session.token);
      const forgedPayload = { ...(decoded?.payload || {}), is_admin: true };
      const forgedToken = buildNoneAlgToken(forgedPayload);

      const res = await api.get('/dashboard', { headers: { Authorization: `Bearer ${forgedToken}` } });
      const status = res.status();
      await api.dispose();

      testInfo.attach('jwt-none-alg-probe', {
        body: JSON.stringify({ forgedToken, forgedPayload, status }, null, 2),
        contentType: 'application/json'
      });
      return { forgedPayload, status };
    });

    await test.step('Verify the forged token was rejected', async () => {
      const accepted = status === 200;

      if (accepted) {
        reporter.reportVulnerability(
          'API2_AUTH',
          { endpoint: 'GET /dashboard', technique: 'alg:none unsecured JWS', forgedPayload, status },
          [
            'Remove "none" from the accepted algorithms list in auth.py (ALGORITHMS should be [\'HS256\'] only).',
            'Never derive the accepted algorithm from the token itself — pin it server-side.'
          ]
        );
      } else {
        reporter.reportPass(
          `A forged alg:none token was rejected (status ${status}) despite 'none' being present in auth.py's ALGORITHMS list.`,
          'API2:2023 - Broken Authentication'
        );
      }
    });
  });
});
