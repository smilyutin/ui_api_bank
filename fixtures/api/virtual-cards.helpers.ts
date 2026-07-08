import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Virtual Card Helpers
 *
 * Supports API tests for the virtual card surfaces:
 * - `POST /api/virtual-cards/create`                (any authenticated user)
 * - `GET  /api/virtual-cards`                        (owner's cards)
 * - `POST /api/virtual-cards/<id>/toggle-freeze`     (no ownership check in app.py)
 * - `GET  /api/virtual-cards/<id>/transactions`      (no ownership check in app.py)
 * - `POST /api/virtual-cards/<id>/update-limit`      (mass assignment: any field, no ownership check)
 *
 * `POST /create` never returns the new row's id, only its card_number and other
 * details (app.py), so `createVirtualCardAndFetch` creates the card and then
 * re-fetches the list to recover the id by matching on the unique card_number.
 */

export type CreateCardPayload = { card_limit?: number | string; card_type?: string };

export type VirtualCardRow = {
	id: number;
	card_number: string;
	cvv: string;
	expiry_date: string;
	limit: number;
	balance: number;
	is_frozen: boolean;
	is_active: boolean;
	created_at: string;
	last_used_at: string | null;
	card_type: string;
};

export async function createVirtualCard(
	api: APIRequestContext,
	token: string,
	payload: CreateCardPayload = {}
): Promise<APIResponse> {
	return api.post('/api/virtual-cards/create', {
		headers: { Authorization: `Bearer ${token}` },
		data: payload
	});
}

export async function listVirtualCards(api: APIRequestContext, token: string): Promise<APIResponse> {
	return api.get('/api/virtual-cards', {
		headers: { Authorization: `Bearer ${token}` }
	});
}

export async function toggleCardFreeze(api: APIRequestContext, token: string, cardId: number): Promise<APIResponse> {
	return api.post(`/api/virtual-cards/${cardId}/toggle-freeze`, {
		headers: { Authorization: `Bearer ${token}` }
	});
}

export async function getCardTransactions(api: APIRequestContext, token: string, cardId: number): Promise<APIResponse> {
	return api.get(`/api/virtual-cards/${cardId}/transactions`, {
		headers: { Authorization: `Bearer ${token}` }
	});
}

/**
 * Sends the given fields verbatim as the JSON body — including fields the UI
 * never sends (e.g. `current_balance`, `is_frozen`) — to probe the mass
 * assignment vulnerability in app.py's update-limit handler.
 */
export async function updateCardLimit(
	api: APIRequestContext,
	token: string,
	cardId: number,
	fields: Record<string, unknown>
): Promise<APIResponse> {
	return api.post(`/api/virtual-cards/${cardId}/update-limit`, {
		headers: { Authorization: `Bearer ${token}` },
		data: fields
	});
}

export async function findCardByNumber(
	api: APIRequestContext,
	token: string,
	cardNumber: string
): Promise<VirtualCardRow | null> {
	const res = await listVirtualCards(api, token);
	if (res.status() !== 200) return null;
	const body = await res.json().catch(() => null);
	const cards: VirtualCardRow[] = body?.cards || [];
	return cards.find((c) => c.card_number === cardNumber) || null;
}

/**
 * Creates a card and recovers its full row (including id) from the list
 * endpoint by matching on the card_number returned at creation time.
 */
export async function createVirtualCardAndFetch(
	api: APIRequestContext,
	token: string,
	payload: CreateCardPayload = {}
): Promise<{ createRes: APIResponse; card: VirtualCardRow | null }> {
	const createRes = await createVirtualCard(api, token, payload);
	if (createRes.status() !== 200) return { createRes, card: null };

	const createBody = await createRes.json().catch(() => null);
	const cardNumber = createBody?.card_details?.card_number;
	if (!cardNumber) return { createRes, card: null };

	const card = await findCardByNumber(api, token, cardNumber);
	return { createRes, card };
}
