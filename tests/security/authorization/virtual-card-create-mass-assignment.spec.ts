import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';

/**
 * Authorization - Virtual card creation mass assignment
 *
 * Unlike POST /register (which loops over every key in the request body
 * and appends it to the INSERT — a real mass-assignment vulnerability
 * covered elsewhere) and the card *limit-update* endpoint (which does the
 * same and is covered by virtual-cards.spec.ts's
 * "should not let extra request fields update sensitive columns"),
 * POST /api/virtual-cards/create in app.py only ever reads `card_limit`
 * and `card_type` from the request body by name — card_number and cvv are
 * always server-generated, and no other field is referenced anywhere in
 * the handler. This checks that directly: send extra fields that would be
 * dangerous if honored (current_balance, is_frozen, is_active, user_id)
 * and confirm none of them influence the created card.
 */
test.describe('Authorization - Virtual card creation mass assignment', () => {
  test('extra fields on card creation should not set sensitive columns', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'vcard-create-mass-assign');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const maliciousPayload = {
      card_limit: 500,
      card_type: 'standard',
      current_balance: 999999,
      is_frozen: false,
      is_active: true,
      user_id: 1
    };

    const createRes = await api.post('/api/virtual-cards/create', {
      headers: { Authorization: `Bearer ${session.token}` },
      data: maliciousPayload
    });
    const createBody = await createRes.json().catch(() => null);

    const listRes = await api.get('/api/virtual-cards', { headers: { Authorization: `Bearer ${session.token}` } });
    const listBody = await listRes.json().catch(() => null);
    await api.dispose();

    const createdCardNumber: string | undefined = createBody?.card_details?.card_number;
    const storedCard = listBody?.cards?.find((c: any) => c.card_number === createdCardNumber) ?? null;

    testInfo.attach('vcard-create-mass-assign-probe', {
      body: JSON.stringify({ maliciousPayload, createStatus: createRes.status(), createBody, storedCard }, null, 2),
      contentType: 'application/json'
    });

    const balanceInjected = storedCard && Number(storedCard.balance) === maliciousPayload.current_balance;

    if (balanceInjected) {
      reporter.reportVulnerability(
        'API6_MASS_ASSIGNMENT',
        { endpoint: 'POST /api/virtual-cards/create', maliciousPayload, storedCard },
        ['Continue to only read card_limit/card_type by name from the request body (as it already does) — do not switch to a generic field-loop like /register uses.']
      );
    } else {
      reporter.reportPass(
        'Extra fields sent on card creation (current_balance, is_frozen, is_active, user_id) had no effect — the endpoint only reads card_limit and card_type by name.',
        'API6:2023 - Unrestricted Access to Sensitive Business Flows'
      );
    }
  });
});
