import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { createRandomUser } from '../utils/test-users';
import { probeOversizedPayload } from '../sec-objects/abuse/payload-size.logic';

/**
 * Abuse - Payload size limits
 *
 * app.py never sets `MAX_CONTENT_LENGTH` (confirmed by inspection — it's
 * absent from the whole file), and `users.username` is a Postgres `TEXT`
 * column with no length constraint (database.py), so nothing in the stack
 * bounds request body size before it reaches an INSERT. This probes
 * POST /register (public, unauthenticated — the cheapest amplification
 * target) with an oversized `username` field.
 */
const OVERSIZED_BYTES = 2 * 1024 * 1024; // 2MB

test.describe('@security Abuse - Payload size', () => {
  test('POST /register should reject an oversized username field instead of accepting or crashing on it', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const probe = await test.step('Submit an oversized username field', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      const { password } = createRandomUser('payload-size');

      const probe = await probeOversizedPayload(api, '/register', { password }, 'username', OVERSIZED_BYTES);
      await api.dispose();

      testInfo.attach('payload-size-probe', {
        body: JSON.stringify(probe, null, 2),
        contentType: 'application/json'
      });
      return probe;
    });

    await test.step('Verify it was rejected cleanly', async () => {
    if (probe.rejectedCleanly) {
        reporter.reportPass(
          `POST /register rejected a ${probe.sizeBytes}-byte username with status ${probe.status}.`,
          'API4:2023 - Unrestricted Resource Consumption'
        );
      } else {
        reporter.reportVulnerability(
          'API4_RATE_LIMIT',
          {
            endpoint: 'POST /register',
            field: 'username',
            sizeBytes: probe.sizeBytes,
            status: probe.status,
            errorMessage: probe.errorMessage,
            durationMs: probe.durationMs
          },
          [
            'Set Flask\'s MAX_CONTENT_LENGTH to a reasonable ceiling for JSON API requests.',
            'Add explicit per-field length limits (e.g. username <= 64 chars) validated before any database write.',
            'Return 413 Payload Too Large for requests exceeding the configured limit.'
          ]
        );
      }
    });
  });
});
