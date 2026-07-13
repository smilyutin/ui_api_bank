import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
import { validateSchema } from '../../helpers/schema-validator';
import { establishAccountSession } from '../../fixtures/api/transactions.helpers';
import {
  createVirtualCard,
  createVirtualCardAndFetch,
  listVirtualCards,
  toggleCardFreeze,
  getCardTransactions,
  updateCardLimit
} from '../../fixtures/api/virtual-cards.helpers';

/**
 * API Virtual Card Tests
 *
 * These tests exercise the virtual card surfaces:
 *   - POST /api/virtual-cards/create                (any authenticated user)
 *   - GET  /api/virtual-cards                        (owner's cards)
 *   - POST /api/virtual-cards/<id>/toggle-freeze     (no ownership check)
 *   - GET  /api/virtual-cards/<id>/transactions      (no ownership check)
 *   - POST /api/virtual-cards/<id>/update-limit      (mass assignment, no ownership check)
 *
 * Test Strategy:
 * 1. Functional: an authenticated user can create a card and see it listed
 *    with the fields they requested; legitimate freeze/unfreeze and limit
 *    updates round-trip correctly.
 * 2. Security: probe card_limit bounds validation, SQL injection / detailed
 *    error exposure in card_type, plaintext card_number/cvv exposure in the
 *    list response, mass assignment on update-limit, and BOLA on
 *    toggle-freeze / transactions / update-limit (a second authenticated
 *    user acting on the first user's card id).
 *
 * Each test establishes its own account session (rather than sharing one
 * from beforeAll) because several tests assert on exact card state and
 * Playwright runs this suite with fullyParallel enabled.
 */

const AUTH_DENIED_STATUSES = [401, 403];

test.describe('API - Virtual card creation', () => {
  test('POST /api/virtual-cards/create should require authentication', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const anon = await request.newContext({ baseURL: baseURL.toString() });
    const res = await createVirtualCard(anon, '', { card_limit: 500 });
    const status = res.status();
    await anon.dispose();

    expect(AUTH_DENIED_STATUSES).toContain(status);
    reporter.reportPass(
      'Virtual card creation endpoint rejected a request without a valid token.',
      'API2:2023 - Broken Authentication'
    );
  });

  test('should let an authenticated user create a card with the requested limit and type', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'vcard-basic');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { createRes, card } = await createVirtualCardAndFetch(api, session.token, {
      card_limit: 1500,
      card_type: 'premium'
    });
    const createBody = await createRes.json().catch(() => null);
    await api.dispose();

    expect(createRes.status()).toBe(200);
    expect(createBody?.status).toBe('success');
    expect(createBody?.card_details?.card_number).toMatch(/^\d{16}$/);
    expect(createBody?.card_details?.cvv).toMatch(/^\d{3}$/);
    expect(createBody?.card_details?.expiry_date).toMatch(/^\d{2}\/\d{2}$/);
    await validateSchema('virtual-cards-schema', 'POST_create', createBody);

    expect(card).toBeTruthy();
    expect(card?.card_type).toBe('premium');
    expect(card?.limit).toBe(1500);
    expect(card?.is_active).toBe(true);
    expect(card?.is_frozen).toBe(false);

    reporter.reportPass(
      'Authenticated user created a virtual card and it was persisted with the requested limit and type.',
      'API6:2023 - Unrestricted Access to Sensitive Business Flows'
    );
  });

  test('should not validate card_limit bounds (negative limit accepted)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'vcard-negative');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { createRes, card } = await createVirtualCardAndFetch(api, session.token, { card_limit: -500 });
    const createBody = await createRes.json().catch(() => null);
    await api.dispose();

    testInfo.attach('negative-limit-probe', { body: JSON.stringify({ createBody, card }, null, 2), contentType: 'application/json' });

    const accepted = createRes.status() === 200 && createBody?.status === 'success' && card?.limit === -500;

    if (accepted) {
      reporter.reportVulnerability(
        'API6_MASS_ASSIGNMENT',
        {
          endpoint: '/api/virtual-cards/create',
          limitSubmitted: -500,
          responseStatus: createRes.status(),
          persistedLimit: card?.limit
        },
        [
          'Reject non-positive card_limit values server-side before creating the card.',
          'Apply a sane maximum card_limit to prevent unbounded spending authority from a single request.'
        ]
      );
    } else {
      expect(createRes.status()).toBeGreaterThanOrEqual(400);
      reporter.reportPass(
        'Virtual card creation endpoint rejected a negative card_limit.',
        'API6:2023 - Unrestricted Access to Sensitive Business Flows'
      );
    }
  });

  test('should not build the card_type column value with unsanitized input (SQL injection / error exposure)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'vcard-sqli');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    // A single unescaped apostrophe in an otherwise benign value is the
    // standard non-destructive probe for string-interpolated SQL: it breaks
    // out of the quoted literal in app.py's f-string INSERT without needing
    // any destructive payload, and confirms whether the raw DB error (which
    // reveals the query structure) reaches the client.
    const res = await createVirtualCard(api, session.token, { card_limit: 500, card_type: "o'brien" });
    const status = res.status();
    const body = await res.json().catch(() => null);
    await api.dispose();

    testInfo.attach('card-type-sqli-probe', { body: JSON.stringify({ status, body }, null, 2), contentType: 'application/json' });

    const revealsRawSqlError = status === 500 && /syntax error|psycopg2|SQL|LINE \d+/i.test(body?.message || '');

    if (revealsRawSqlError) {
      reporter.reportVulnerability(
        'API8_SECURITY_MISCONFIGURATION',
        {
          endpoint: '/api/virtual-cards/create',
          field: 'card_type',
          technique: "Unescaped apostrophe in card_type (o'brien) breaking out of the interpolated SQL string literal",
          responseStatus: status,
          exposedMessage: body?.message
        },
        [
          'Use parameterized queries for the card creation INSERT instead of interpolating card_type directly into the SQL string.',
          'Do not return raw database exception text (str(e)) to API clients; log it server-side and return a generic error message.'
        ]
      );
    } else {
      expect(status).not.toBe(500);
      reporter.reportPass(
        "Virtual card creation handled an apostrophe in card_type without exposing a raw database error.",
        'API8:2023 - Security Misconfiguration'
      );
    }
  });

  test('should not generate card numbers with a non-cryptographic random source', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'vcard-predictable');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const cardNumbers: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await createVirtualCard(api, session.token, { card_limit: 100 });
      const body = await res.json().catch(() => null);
      const cardNumber: string | undefined = body?.card_details?.card_number;
      if (cardNumber) cardNumbers.push(cardNumber);
    }
    await api.dispose();

    testInfo.attach('card-number-predictability-probe', { body: JSON.stringify({ cardNumbers }, null, 2), contentType: 'application/json' });

    if (cardNumbers.length < 2) {
      reporter.reportSkip('Could not create enough cards back-to-back to probe number generation on this target.');
      return;
    }

    const hasDuplicate = new Set(cardNumbers).size !== cardNumbers.length;

    // app.py's generate_card_number()/generate_cvv() use
    // random.choices(string.digits, k=...) — Python's Mersenne-Twister
    // `random` module, not the `secrets` module (CWE-330: Use of
    // Insufficiently Random Values). This is a source-level finding
    // (visible in app.py, not something these three samples alone prove
    // via statistical attack) — the live probe here rules out the more
    // naive failure mode this was originally suspected to be (a
    // sequential/incrementing counter, the way bill-payment reference
    // numbers are int(time.time())-based): these card numbers are not
    // sequential. That doesn't make the underlying RNG choice safe.
    reporter.reportVulnerability(
      'API8_SECURITY_MISCONFIGURATION',
      {
        endpoint: '/api/virtual-cards/create',
        sampledCardNumbers: cardNumbers,
        hasDuplicateInSample: hasDuplicate,
        source: "app.py generate_card_number()/generate_cvv() use random.choices(string.digits, ...) — Python's non-cryptographic random module"
      },
      [
        "Use the secrets module (e.g. secrets.choice / secrets.randbelow) instead of random for card_number and cvv generation — both are security-sensitive values.",
        'Add a uniqueness constraint on virtual_cards.card_number at the database level regardless of generator choice.'
      ]
    );
  });
});

test.describe('API - Virtual card listing', () => {
  test('GET /api/virtual-cards should require authentication', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const anon = await request.newContext({ baseURL: baseURL.toString() });
    const res = await listVirtualCards(anon, '');
    const status = res.status();
    await anon.dispose();

    expect(AUTH_DENIED_STATUSES).toContain(status);
    reporter.reportPass(
      'Virtual card listing endpoint rejected a request without a valid token.',
      'API2:2023 - Broken Authentication'
    );
  });

  test('should return the full card number and CVV in plaintext for the owner (excessive data exposure)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'vcard-exposure');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, session.token, { card_limit: 750 });

    const listRes = await listVirtualCards(api, session.token);
    const listBody = await listRes.json().catch(() => null);
    await api.dispose();

    expect(card).toBeTruthy();
    await validateSchema('virtual-cards-schema', 'GET_list', listBody);

    const exposesFullCardNumber = /^\d{16}$/.test(card?.card_number || '');
    const exposesCvv = /^\d{3}$/.test(card?.cvv || '');

    if (exposesFullCardNumber && exposesCvv) {
      reporter.reportVulnerability(
        'API3_DATA_EXPOSURE',
        {
          endpoint: '/api/virtual-cards',
          disclosedFields: ['card_number (full, unmasked)', 'cvv'],
          cardId: card?.id
        },
        [
          'Mask all but the last four digits of card_number in list/read responses.',
          'Never return CVV after card creation; it should not be retrievable at all once issued.'
        ]
      );
    } else {
      reporter.reportPass(
        'Virtual card listing endpoint did not return an unmasked card number or CVV.',
        'API3:2023 - Broken Object Property Level Authorization'
      );
    }
  });
});

test.describe('API - Virtual card freeze toggle', () => {
  test('should freeze and unfreeze the owner\'s own card', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'vcard-freeze');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, session.token, { card_limit: 400 });
    if (!card) {
      reporter.reportSkip('Could not create a virtual card to run the freeze/unfreeze check.');
      await api.dispose();
      test.skip(true, 'Card not created');
      return;
    }

    const freezeRes = await toggleCardFreeze(api, session.token, card.id);
    const freezeBody = await freezeRes.json().catch(() => null);

    const unfreezeRes = await toggleCardFreeze(api, session.token, card.id);
    const unfreezeBody = await unfreezeRes.json().catch(() => null);
    await api.dispose();

    expect(freezeRes.status()).toBe(200);
    expect(freezeBody?.message).toMatch(/frozen/i);
    expect(unfreezeRes.status()).toBe(200);
    expect(unfreezeBody?.message).toMatch(/unfrozen/i);
    await validateSchema('virtual-cards-schema', 'POST_toggle_freeze', freezeBody);

    reporter.reportPass(
      'Owner successfully froze and unfroze their own virtual card.',
      'API6:2023 - Unrestricted Access to Sensitive Business Flows'
    );
  });

  test('should not let another authenticated user freeze someone else\'s card (BOLA)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const owner = await establishAccountSession(api, 'vcard-bola-owner');
    const attacker = await establishAccountSession(api, 'vcard-bola-attacker');
    if (!owner || !attacker) {
      reporter.reportSkip('Could not establish two account sessions (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account sessions available');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, owner.token, { card_limit: 400 });
    if (!card) {
      reporter.reportSkip('Could not create a virtual card to run the BOLA check.');
      await api.dispose();
      test.skip(true, 'Card not created');
      return;
    }

    const crossUserRes = await toggleCardFreeze(api, attacker.token, card.id);
    const crossUserBody = await crossUserRes.json().catch(() => null);
    await api.dispose();

    testInfo.attach('toggle-freeze-bola-probe', {
      body: JSON.stringify({ status: crossUserRes.status(), body: crossUserBody }, null, 2),
      contentType: 'application/json'
    });

    const bolaConfirmed = crossUserRes.status() === 200 && crossUserBody?.status === 'success';

    if (bolaConfirmed) {
      reporter.reportVulnerability(
        'API1_BOLA',
        {
          endpoint: '/api/virtual-cards/<id>/toggle-freeze',
          cardId: card.id,
          cardOwner: owner.userId,
          actingUser: attacker.userId,
          responseStatus: crossUserRes.status()
        },
        [
          'Verify the requesting user owns the card (WHERE id = %s AND user_id = %s) before toggling is_frozen.',
          'Return 403/404 for freeze requests against a card the caller does not own.'
        ]
      );
    } else {
      expect(AUTH_DENIED_STATUSES.concat(404)).toContain(crossUserRes.status());
      reporter.reportPass(
        "Toggle-freeze endpoint rejected a request from a user who does not own the card.",
        'API1:2023 - Broken Object Level Authorization'
      );
    }
  });
});

test.describe('API - Virtual card transaction history', () => {
  test('should not let another authenticated user read someone else\'s card transactions (BOLA)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const owner = await establishAccountSession(api, 'vcard-txn-owner');
    const attacker = await establishAccountSession(api, 'vcard-txn-attacker');
    if (!owner || !attacker) {
      reporter.reportSkip('Could not establish two account sessions (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account sessions available');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, owner.token, { card_limit: 400 });
    if (!card) {
      reporter.reportSkip('Could not create a virtual card to run the BOLA check.');
      await api.dispose();
      test.skip(true, 'Card not created');
      return;
    }

    const crossUserRes = await getCardTransactions(api, attacker.token, card.id);
    const crossUserBody = await crossUserRes.json().catch(() => null);
    await api.dispose();

    testInfo.attach('transactions-bola-probe', {
      body: JSON.stringify({ status: crossUserRes.status(), body: crossUserBody }, null, 2),
      contentType: 'application/json'
    });

    const bolaConfirmed = crossUserRes.status() === 200 && crossUserBody?.status === 'success';

    if (bolaConfirmed) {
      await validateSchema('virtual-cards-schema', 'GET_card_transactions', crossUserBody);
      reporter.reportVulnerability(
        'API1_BOLA',
        {
          endpoint: '/api/virtual-cards/<id>/transactions',
          cardId: card.id,
          cardOwner: owner.userId,
          actingUser: attacker.userId,
          responseStatus: crossUserRes.status()
        },
        [
          'Verify the requesting user owns the card before returning its transaction history.',
          'Return 403/404 for transaction history requests against a card the caller does not own.'
        ]
      );
    } else {
      expect(AUTH_DENIED_STATUSES.concat(404)).toContain(crossUserRes.status());
      reporter.reportPass(
        "Card transaction history endpoint rejected a request from a user who does not own the card.",
        'API1:2023 - Broken Object Level Authorization'
      );
    }
  });
});

test.describe('API - Virtual card limit update', () => {
  test('should let the owner update their own card_limit', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'vcard-update-limit');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, session.token, { card_limit: 500 });
    if (!card) {
      reporter.reportSkip('Could not create a virtual card to run the update-limit check.');
      await api.dispose();
      test.skip(true, 'Card not created');
      return;
    }

    const updateRes = await updateCardLimit(api, session.token, card.id, { card_limit: 2000 });
    const updateBody = await updateRes.json().catch(() => null);
    await api.dispose();

    expect(updateRes.status()).toBe(200);
    expect(updateBody?.status).toBe('success');
    expect(updateBody?.debug_info?.card_details?.card_limit).toBe(2000);
    await validateSchema('virtual-cards-schema', 'POST_update_limit', updateBody);

    reporter.reportPass(
      "Owner successfully updated their own card's limit.",
      'API6:2023 - Unrestricted Access to Sensitive Business Flows'
    );
  });

  test('should not let extra request fields update sensitive columns like current_balance (mass assignment)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'vcard-mass-assign');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, session.token, { card_limit: 500 });
    if (!card) {
      reporter.reportSkip('Could not create a virtual card to run the mass-assignment check.');
      await api.dispose();
      test.skip(true, 'Card not created');
      return;
    }

    // The UI only ever sends { card_limit }, but the handler iterates every
    // key in the request body with no allowlist (app.py), so current_balance
    // is a legitimate DB column an attacker can set directly.
    const res = await updateCardLimit(api, session.token, card.id, { current_balance: 999999 });
    const status = res.status();
    const body = await res.json().catch(() => null);
    await api.dispose();

    testInfo.attach('update-limit-mass-assignment-probe', {
      body: JSON.stringify({ status, body }, null, 2),
      contentType: 'application/json'
    });

    const balanceFabricated = status === 200 && body?.debug_info?.card_details?.current_balance === 999999;

    if (balanceFabricated) {
      reporter.reportVulnerability(
        'API6_MASS_ASSIGNMENT',
        {
          endpoint: '/api/virtual-cards/<id>/update-limit',
          fieldSubmitted: 'current_balance=999999',
          responseStatus: status,
          cardId: card.id
        },
        [
          'Build the UPDATE from an explicit allowlist of fields (card_limit only) instead of iterating every key in the request body.',
          'Never accept current_balance, is_frozen, is_active, card_number, or cvv from client-supplied update data.'
        ]
      );
    } else {
      expect(body?.debug_info?.card_details?.current_balance).not.toBe(999999);
      reporter.reportPass(
        'Update-limit endpoint did not honor a client-supplied current_balance field.',
        'API6:2023 - Unrestricted Access to Sensitive Business Flows'
      );
    }
  });

  test('should not let another authenticated user update someone else\'s card limit (BOLA)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const owner = await establishAccountSession(api, 'vcard-update-bola-owner');
    const attacker = await establishAccountSession(api, 'vcard-update-bola-attacker');
    if (!owner || !attacker) {
      reporter.reportSkip('Could not establish two account sessions (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account sessions available');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, owner.token, { card_limit: 500 });
    if (!card) {
      reporter.reportSkip('Could not create a virtual card to run the BOLA check.');
      await api.dispose();
      test.skip(true, 'Card not created');
      return;
    }

    const crossUserRes = await updateCardLimit(api, attacker.token, card.id, { card_limit: 999 });
    const crossUserBody = await crossUserRes.json().catch(() => null);
    await api.dispose();

    testInfo.attach('update-limit-bola-probe', {
      body: JSON.stringify({ status: crossUserRes.status(), body: crossUserBody }, null, 2),
      contentType: 'application/json'
    });

    const bolaConfirmed = crossUserRes.status() === 200 && crossUserBody?.status === 'success';

    if (bolaConfirmed) {
      reporter.reportVulnerability(
        'API1_BOLA',
        {
          endpoint: '/api/virtual-cards/<id>/update-limit',
          cardId: card.id,
          cardOwner: owner.userId,
          actingUser: attacker.userId,
          responseStatus: crossUserRes.status()
        },
        [
          'Verify the requesting user owns the card before applying any update-limit changes.',
          'Return 403/404 for update-limit requests against a card the caller does not own.'
        ]
      );
    } else {
      expect(AUTH_DENIED_STATUSES.concat(404)).toContain(crossUserRes.status());
      reporter.reportPass(
        "Update-limit endpoint rejected a request from a user who does not own the card.",
        'API1:2023 - Broken Object Level Authorization'
      );
    }
  });
});
