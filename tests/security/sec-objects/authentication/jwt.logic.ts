export type DecodedJwt = {
	header: Record<string, unknown>;
	payload: Record<string, unknown>;
};

/**
 * Decodes a JWT's header/payload without verifying the signature — for
 * inspecting claims (e.g. confirming `exp` is absent), not for trusting
 * the content.
 */
export function decodeJwtNoVerify(token: string): DecodedJwt | null {
	const parts = token.split('.');
	if (parts.length < 2) return null;

	try {
		const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
		const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
		return { header, payload };
	} catch {
		return null;
	}
}

/**
 * Builds an unsecured ("alg": "none") JWS from a real token's payload, per
 * RFC 7519 §6 — header.payload. with an empty signature segment. auth.py's
 * `ALGORITHMS = ['HS256', 'none']` accepts 'none' as a valid algorithm
 * name; this probes whether verify_token() actually honors an unsigned
 * token of that shape.
 */
export function buildNoneAlgToken(payload: Record<string, unknown>): string {
	const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
	return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.`;
}
