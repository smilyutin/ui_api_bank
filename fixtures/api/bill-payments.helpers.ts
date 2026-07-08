import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Bill Payment Helpers
 *
 * Supports API tests for the bill payment surfaces:
 * - `GET  /api/bill-categories`              (public, no auth)
 * - `GET  /api/billers/by-category/<id>`     (public, no auth)
 * - `POST /api/bill-payments/create`         (any authenticated user)
 * - `GET  /api/bill-payments/history`        (owner-scoped via token)
 *
 * Seed category/biller ids are not stable across environments (the seed
 * insert has no idempotency guard on `billers`, so re-running app init can
 * append duplicate rows), so tests must discover a real category/biller pair
 * through the public endpoints rather than hardcoding ids. `discoverBiller`
 * does that.
 *
 * `POST /create` already returns a `reference` directly in its response, so
 * most tests don't need `findPaymentByReference` — only ones that need the
 * full persisted row shape (card_number, status, biller_name, ...) do.
 */

export type BillCategoryRow = { id: number; name: string; description: string | null };

export type BillerRow = {
	id: number;
	name: string;
	account_number: string;
	description: string | null;
	minimum_amount: number;
	maximum_amount: number | null;
};

export type BillPaymentRow = {
	id: number;
	amount: number;
	payment_method: string;
	card_number: string | null;
	reference: string;
	status: string;
	created_at: string;
	processed_at: string | null;
	description: string | null;
	biller_name: string;
	category_name: string;
};

/**
 * Intentionally loose: create-payment tests need to send malformed/probe
 * values (a string card_id, a negative amount, a missing biller_id, ...) to
 * exercise validation gaps, so this is not a strict DTO.
 */
export type BillPaymentPayload = Record<string, unknown>;

export async function getBillCategories(api: APIRequestContext): Promise<APIResponse> {
	return api.get('/api/bill-categories');
}

export async function getBillersByCategory(api: APIRequestContext, categoryId: number): Promise<APIResponse> {
	return api.get(`/api/billers/by-category/${categoryId}`);
}

export async function createBillPayment(
	api: APIRequestContext,
	token: string,
	payload: BillPaymentPayload
): Promise<APIResponse> {
	return api.post('/api/bill-payments/create', {
		headers: { Authorization: `Bearer ${token}` },
		data: payload
	});
}

export async function getBillPaymentHistory(api: APIRequestContext, token: string): Promise<APIResponse> {
	return api.get('/api/bill-payments/history', {
		headers: { Authorization: `Bearer ${token}` }
	});
}

export async function findPaymentByReference(
	api: APIRequestContext,
	token: string,
	reference: string
): Promise<BillPaymentRow | null> {
	const res = await getBillPaymentHistory(api, token);
	if (res.status() !== 200) return null;
	const body = await res.json().catch(() => null);
	const payments: BillPaymentRow[] = body?.payments || [];
	return payments.find((p) => p.reference === reference) || null;
}

/**
 * Discovers a real category/biller pair via the public catalog endpoints
 * instead of hardcoding seeded ids, since seed order/id stability isn't
 * guaranteed across environments (or even across repeated app restarts —
 * the `billers` seed insert has no existence check).
 */
export async function discoverBiller(
	api: APIRequestContext
): Promise<{ category: BillCategoryRow; biller: BillerRow } | null> {
	const catRes = await getBillCategories(api);
	if (catRes.status() !== 200) return null;
	const catBody = await catRes.json().catch(() => null);
	const category: BillCategoryRow | undefined = catBody?.categories?.[0];
	if (!category) return null;

	const billerRes = await getBillersByCategory(api, category.id);
	if (billerRes.status() !== 200) return null;
	const billerBody = await billerRes.json().catch(() => null);
	const biller: BillerRow | undefined = billerBody?.billers?.[0];
	if (!biller) return null;

	return { category, biller };
}
