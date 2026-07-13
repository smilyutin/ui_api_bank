export type CookieAttributes = {
	name: string;
	value: string;
	httpOnly: boolean;
	secure: boolean;
	sameSite: string | null;
	raw: string;
};

/**
 * Parses a single Set-Cookie header value for the named cookie's
 * attributes. Playwright's APIResponse.headers() folds multiple Set-Cookie
 * headers into one comma-joined string, so this scans for the named
 * cookie's segment rather than assuming the whole header is one cookie.
 */
export function parseCookieAttributes(setCookieHeader: string | undefined, name: string): CookieAttributes | null {
	if (!setCookieHeader) return null;

	// Split on commas that are followed by "<token>=" (a new cookie starting),
	// since Expires= within a single cookie also contains a comma.
	const cookieSegments = setCookieHeader.split(/,(?=\s*[^;=\s]+=)/);
	const segment = cookieSegments.find((s) => new RegExp(`(?:^|\\s)${name}=`).test(s));
	if (!segment) return null;

	const valueMatch = segment.match(new RegExp(`${name}=([^;]*)`));
	const value = valueMatch ? decodeURIComponent(valueMatch[1]) : '';

	return {
		name,
		value,
		httpOnly: /;\s*httponly/i.test(segment),
		secure: /;\s*secure/i.test(segment),
		sameSite: segment.match(/;\s*samesite=([^;]*)/i)?.[1] ?? null,
		raw: segment.trim()
	};
}
