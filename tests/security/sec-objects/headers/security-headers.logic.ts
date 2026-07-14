import type { APIRequestContext } from '@playwright/test';

export type SecurityHeaderProbe = {
	endpoint: string;
	headers: Record<string, string | null>;
};

export type EndpointToCheck = {
	/** Short label for evidence/reporting, e.g. "public HTML page". */
	label: string;
	path: string;
	/** Extra request headers, e.g. an Authorization bearer token. */
	headers?: Record<string, string>;
};

/**
 * Representative endpoints covering the distinct route shapes in this app:
 * a public unauthenticated HTML page, an authenticated HTML page (the
 * highest-value framing/CSP target — this is where the account balance and
 * actions live), and a public JSON API endpoint. Checking all three (rather
 * than just /login, as these specs originally did) confirms the missing
 * headers are systemic across the app, not specific to one route.
 */
export function buildRepresentativeEndpoints(authToken?: string | null): EndpointToCheck[] {
	const endpoints: EndpointToCheck[] = [
		{ label: 'public HTML page', path: '/login' },
		{ label: 'public JSON API', path: '/api/bill-categories' }
	];
	if (authToken) {
		endpoints.push({ label: 'authenticated HTML page', path: '/dashboard', headers: { Authorization: `Bearer ${authToken}` } });
	}
	return endpoints;
}

/**
 * Fetches a page and pulls out the small set of security-relevant response
 * headers every check in tests/security/headers/ cares about — one shared
 * probe so clickjacking/hsts/nosniff/permissions-policy/referrer-policy
 * specs don't each re-implement the same fetch.
 */
export async function fetchSecurityHeaders(api: APIRequestContext, endpoint: string, extraHeaders?: Record<string, string>): Promise<SecurityHeaderProbe> {
	const res = await api.get(endpoint, extraHeaders ? { headers: extraHeaders } : undefined);
	const h = res.headers();

	return {
		endpoint,
		headers: {
			'x-frame-options': h['x-frame-options'] ?? null,
			'strict-transport-security': h['strict-transport-security'] ?? null,
			'x-content-type-options': h['x-content-type-options'] ?? null,
			'permissions-policy': h['permissions-policy'] ?? null,
			'referrer-policy': h['referrer-policy'] ?? null,
			'content-security-policy': h['content-security-policy'] ?? null
		}
	};
}

export type MultiEndpointProbe = {
	label: string;
	path: string;
	headerValue: string | null;
};

/**
 * Checks one header across every representative endpoint and returns a
 * per-endpoint breakdown plus whether *any* of them had the header set.
 */
export async function fetchHeaderAcrossEndpoints(
	api: APIRequestContext,
	endpoints: EndpointToCheck[],
	headerName: keyof SecurityHeaderProbe['headers']
): Promise<{ results: MultiEndpointProbe[]; missingEverywhere: boolean }> {
	const results: MultiEndpointProbe[] = [];
	for (const ep of endpoints) {
		const probe = await fetchSecurityHeaders(api, ep.path, ep.headers);
		results.push({ label: ep.label, path: ep.path, headerValue: probe.headers[headerName] });
	}
	return { results, missingEverywhere: results.every((r) => !r.headerValue) };
}
