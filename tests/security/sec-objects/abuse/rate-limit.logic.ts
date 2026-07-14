import type { APIResponse } from '@playwright/test';

export type BurstProbeResult = {
	requestCount: number;
	statuses: number[];
	any429: boolean;
	successCount: number;
	durationMs: number;
};

/**
 * Fires `requestCount` copies of `sendRequest` concurrently and summarizes
 * the resulting statuses. A target with real rate limiting should return at
 * least one 429 somewhere in the burst; `any429` being false means nothing
 * throttled the burst at all.
 */
export async function probeBurstRequests(
	sendRequest: () => Promise<APIResponse>,
	requestCount: number
): Promise<BurstProbeResult> {
	const start = Date.now();
	const responses = await Promise.all(Array.from({ length: requestCount }, () => sendRequest()));
	const statuses = responses.map((r) => r.status());

	return {
		requestCount,
		statuses,
		any429: statuses.includes(429),
		successCount: statuses.filter((s) => s >= 200 && s < 400).length,
		durationMs: Date.now() - start
	};
}
