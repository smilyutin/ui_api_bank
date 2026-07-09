import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Money Transfer Helpers
 *
 * Supports API tests for the transfer surface:
 * - `POST /transfer` (any authenticated user; token accepted via the
 *   Authorization header, `?token=` query string, form body, or cookie —
 *   see auth.py's token_required)
 *
 * Balance/history reads (`/check_balance/<account_number>`,
 * `/transactions/<account_number>`) are intentionally not wrapped here —
 * they're called inline in the spec, matching how tests/api/loans.spec.ts
 * and tests/api/ai-chat.spec.ts already call /check_balance directly rather
 * than through a helper.
 */

export type TransferPayload = Record<string, unknown>;

export type TransferResponseBody = {
	status: string;
	message: string;
	new_balance?: number;
};

export async function transfer(api: APIRequestContext, token: string, payload: TransferPayload): Promise<APIResponse> {
	return api.post('/transfer', {
		headers: { Authorization: `Bearer ${token}` },
		data: payload
	});
}
