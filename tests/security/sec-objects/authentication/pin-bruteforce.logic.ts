import type { APIRequestContext } from '@playwright/test';

export type PinBruteforceResult = {
	requestedPin: boolean;
	realPin: string | null;
	wrongAttempts: number;
	wrongGuessStatuses: number[];
	realPinStillWorks: boolean;
};

/**
 * Requests a real reset PIN (via POST /forgot-password, which returns it
 * directly in debug_info — a separate, already-known finding), then fires
 * `wrongAttemptCount` wrong 3-digit guesses at POST /reset-password before
 * finally submitting the real PIN. The 3-digit space (100-999, per app.py's
 * `random.randint(100, 999)`) is only 900 possibilities — this doesn't
 * exhaustively brute force it, just checks whether anything throttles or
 * locks out repeated wrong guesses at all (app.py's own comment:
 * "Vulnerability: No rate limiting on PIN attempts").
 */
export async function probePinBruteforce(
	api: APIRequestContext,
	username: string,
	newPassword: string,
	wrongAttemptCount: number
): Promise<PinBruteforceResult> {
	const forgot = await api.post('/forgot-password', {
		data: { username },
		headers: { 'Content-Type': 'application/json' }
	});
	const forgotBody = await forgot.json().catch(() => null);
	const realPin: string | null = forgotBody?.debug_info?.pin ?? null;

	if (forgot.status() !== 200 || !realPin) {
		return { requestedPin: false, realPin: null, wrongAttempts: 0, wrongGuessStatuses: [], realPinStillWorks: false };
	}

	const wrongGuessStatuses: number[] = [];
	for (let i = 0; i < wrongAttemptCount; i++) {
		let guess: string;
		do {
			guess = String(100 + Math.floor(Math.random() * 900));
		} while (guess === realPin);

		const res = await api.post('/reset-password', {
			data: { username, reset_pin: guess, new_password: 'irrelevant-guess' },
			headers: { 'Content-Type': 'application/json' }
		});
		wrongGuessStatuses.push(res.status());
	}

	const finalRes = await api.post('/reset-password', {
		data: { username, reset_pin: realPin, new_password: newPassword },
		headers: { 'Content-Type': 'application/json' }
	});
	const finalBody = await finalRes.json().catch(() => null);

	return {
		requestedPin: true,
		realPin,
		wrongAttempts: wrongAttemptCount,
		wrongGuessStatuses,
		realPinStillWorks: finalRes.status() === 200 && finalBody?.status === 'success'
	};
}
