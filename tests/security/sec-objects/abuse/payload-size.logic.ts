import type { APIRequestContext, APIResponse } from '@playwright/test';

export type OversizedPayloadProbeResult = {
	sizeBytes: number;
	status: number | null;
	ok: boolean;
	rejectedCleanly: boolean;
	errorMessage: string | null;
	durationMs: number;
};

/**
 * POSTs an oversized JSON body to `endpoint` (a large string value under
 * `field`, merged into `baseBody`) and reports how the server handled it.
 *
 * `rejectedCleanly` is only true for a proper 4xx (413 Payload Too Large,
 * 400, or 422) — a 2xx means the server processed an unbounded payload
 * instead of rejecting it, and a 5xx means it crashed on it rather than
 * validating it up front. Neither counts as a clean rejection.
 */
export async function probeOversizedPayload(
	api: APIRequestContext,
	endpoint: string,
	baseBody: Record<string, unknown>,
	field: string,
	sizeBytes: number
): Promise<OversizedPayloadProbeResult> {
	const oversizedValue = 'A'.repeat(sizeBytes);
	const body = { ...baseBody, [field]: oversizedValue };

	const start = Date.now();
	try {
		const res: APIResponse = await api.post(endpoint, {
			data: body,
			headers: { 'Content-Type': 'application/json' }
		});
		const status = res.status();
		return {
			sizeBytes,
			status,
			ok: status >= 200 && status < 300,
			rejectedCleanly: status === 413 || status === 400 || status === 422,
			errorMessage: null,
			durationMs: Date.now() - start
		};
	} catch (e: any) {
		return {
			sizeBytes,
			status: null,
			ok: false,
			rejectedCleanly: false,
			errorMessage: e?.message || 'request failed',
			durationMs: Date.now() - start
		};
	}
}
