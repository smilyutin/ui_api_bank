import type { APIRequestContext } from '@playwright/test';

export type BruteforceProbeResult = {
	attempts: number;
	failureStatuses: number[];
	correctPasswordStatusAfterBurst: number;
	stillAuthenticatesAfterBurst: boolean;
};

/**
 * Fires `wrongAttempts` failed logins against a real username, then tries
 * the correct password once more. A locked-out account should reject even
 * the correct password (or return a distinct "locked" status); no lockout
 * means the correct password authenticates immediately afterward as if
 * nothing happened.
 */
export async function probeBruteforceLockout(
	api: APIRequestContext,
	username: string,
	correctPassword: string,
	wrongAttempts: number
): Promise<BruteforceProbeResult> {
	const failureStatuses: number[] = [];
	for (let i = 0; i < wrongAttempts; i++) {
		const res = await api.post('/login', {
			data: { username, password: `wrong-password-${i}` },
			headers: { 'Content-Type': 'application/json' }
		});
		failureStatuses.push(res.status());
	}

	const finalRes = await api.post('/login', {
		data: { username, password: correctPassword },
		headers: { 'Content-Type': 'application/json' }
	});
	const correctPasswordStatusAfterBurst = finalRes.status();
	const body = await finalRes.json().catch(() => null);

	return {
		attempts: wrongAttempts,
		failureStatuses,
		correctPasswordStatusAfterBurst,
		stillAuthenticatesAfterBurst: correctPasswordStatusAfterBurst === 200 && body?.status === 'success'
	};
}
