import type { APIRequestContext } from '@playwright/test';

export type PasswordResetResult = {
	requestedPin: boolean;
	pin: string | null;
	resetSucceeded: boolean;
};

/**
 * Drives app.py's PIN-based password reset flow end to end:
 * POST /forgot-password (returns the PIN directly in debug_info — itself a
 * separate, already-known finding) then POST /reset-password with that PIN
 * and a new password. Used to check whether a token issued *before* the
 * reset still authenticates afterward (session-fixation-adjacent: nothing
 * about JWT verification depends on the current password).
 */
export async function resetPasswordViaPin(
	api: APIRequestContext,
	username: string,
	newPassword: string
): Promise<PasswordResetResult> {
	const forgot = await api.post('/forgot-password', {
		data: { username },
		headers: { 'Content-Type': 'application/json' }
	});
	const forgotBody = await forgot.json().catch(() => null);
	const pin: string | null = forgotBody?.debug_info?.pin ?? null;

	if (forgot.status() !== 200 || !pin) {
		return { requestedPin: false, pin: null, resetSucceeded: false };
	}

	const reset = await api.post('/reset-password', {
		data: { username, reset_pin: pin, new_password: newPassword },
		headers: { 'Content-Type': 'application/json' }
	});
	const resetBody = await reset.json().catch(() => null);

	return {
		requestedPin: true,
		pin,
		resetSucceeded: reset.status() === 200 && resetBody?.status === 'success'
	};
}
