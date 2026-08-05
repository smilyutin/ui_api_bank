import { expect, type APIRequestContext, type APIResponse, type Browser } from '@playwright/test';
import { RegisterPage } from '../../pages/register.page';
import { buildRegisterFormSubmission } from './register-form.helpers';

/**
 * API User Creation Tests
 * 
 * These tests verify that the application provides functional API endpoints
 * for user registration and account creation, ensuring the system can be
 * properly tested with valid user credentials.
 * 
 * Test Strategy:
 * 1. Attempt to discover user creation endpoints through common patterns
 * 2. Try multiple content types (form-data and JSON)
 * 3. Parse HTML forms if API endpoints are not available
 * 4. Use OpenAPI/Swagger documentation for endpoint discovery
 * 5. Fall back to UI-based registration if needed
 * 
 * Expected Behavior:
 * - User creation should succeed with valid credentials
 * - Response should indicate successful account creation
 * - Created user should be persisted for future tests
 * - Multiple endpoint formats should be supported
 */

/**
 * Test: Create user account via API
 * 
 * Purpose: Verifies that the application supports user account creation
 * through API endpoints, enabling automated testing with valid credentials.
 * 
 * Test Strategy:
 * 1. Generate random test credentials
 * 2. Try common user creation endpoints
 * 3. Attempt both form-data and JSON content types
 * 4. Parse HTML registration forms if needed
 * 5. Use OpenAPI/Swagger documentation for discovery
 * 6. Fall back to UI-based registration
 * 7. Persist successful user credentials
 */

export type CreatePayload = { email: string; password: string };
export type TriedEntry = { path: string; status: number | string };
export type CreateResult = { response: APIResponse; path: string } | null;
export type CreateUserFailureAnalysis = {
	category: string;
	description: string;
	recommendations: string[];
};
export type CreateUserSuccessAnalysis = {
	category: string;
	description: string;
};

// Statuses indicating successful user creation (HTML forms typically return 200)
const STRICT_SUCCESS_STATUSES = [200];
// Extended success statuses including API variations (201 created, 302 redirect, 409 already exists)
export const EXTENDED_SUCCESS_STATUSES = [200, 201, 302, 303, 409];

// Common user creation endpoint paths to try
const API_REGISTRATION_CANDIDATES = [
	'/api/users', '/api/auth/register', '/api/register', '/users', '/register', '/signup', '/api/v1/users'
];

// Common OpenAPI/Swagger documentation endpoints that list available routes
const OPENAPI_DOC_CANDIDATES = ['/openapi.json', '/swagger.json', '/v3/api-docs', '/api/docs', '/api/docs.json'];

// Record a discovery attempt in the log
const recordTry = (tried: TriedEntry[], path: string, status: number | string) => {
	tried.push({ path, status });
};

// Build JSON payload for user creation (accommodate common field name patterns)
// Note: The users table only has username/password columns (email is in the test payload
// for compatibility with UI registration flows, but not stored in DB)
const buildJsonBody = (payload: CreatePayload) =>
	JSON.stringify({
		username: payload.email,  // Use email as the username for compatibility
		password: payload.password,
	});

// Try creating a user at a given endpoint path, with both form and JSON payloads
const tryCreateAtPath = async (
	apiContext: APIRequestContext,
	path: string,
	payload: CreatePayload,
	tried: TriedEntry[],
	successStatuses: number[]
): Promise<CreateResult> => {
	// /register endpoint requires JSON, so try that first
	// Other endpoints may accept form-encoded, so try JSON first then fallback

	// Try JSON first (works for /register and most modern APIs)
	try {
		const resJson = await apiContext.post(path, {
			data: buildJsonBody(payload),
			headers: { 'Content-Type': 'application/json' }
		});
		recordTry(tried, `${path} (json)`, resJson.status());
		if (successStatuses.includes(resJson.status())) {
			return { response: resJson, path: `${path} (json)` };
		}
	} catch (e: unknown) {
		recordTry(tried, `${path} (json)`, e?.message || 'error');
	}

	// Try form-encoded as fallback
	try {
		const resForm = await apiContext.post(path, { data: payload });
		recordTry(tried, `${path} (form)`, resForm.status());
		if (successStatuses.includes(resForm.status())) {
			return { response: resForm, path: `${path} (form)` };
		}
	} catch (e: unknown) {
		recordTry(tried, `${path} (form)`, e?.message || 'error');
	}

	return null;
};

const tryRegisterHtmlFallback = async (
	apiContext: APIRequestContext,
	baseURL: string,
	payload: CreatePayload,
	tried: TriedEntry[]
): Promise<CreateResult> => {
	try {
		const regGet = await apiContext.get('/register');
		recordTry(tried, '/register (get)', regGet.status());
		const contentType = regGet.headers()['content-type'] || '';
		if (regGet.status() !== 200 || !contentType.includes('html')) return null;

		const html = await regGet.text();
		const { actionPath, formBody, headers } = buildRegisterFormSubmission(
			html,
			{
				identifier: payload.email,
				email: payload.email,
				username: payload.email.split('@')[0],
				password: payload.password
			},
			baseURL
		);
		try {
			const regPost = await apiContext.post(actionPath, { form: formBody, headers });
			recordTry(tried, `${actionPath} (form submit)`, regPost.status());
			if (STRICT_SUCCESS_STATUSES.includes(regPost.status())) {
				return { response: regPost, path: `${actionPath} (form submit)` };
			}
		} catch (e: unknown) {
			recordTry(tried, `${actionPath} (form submit)`, e?.message || 'error');
		}
	} catch (e: unknown) {
		recordTry(tried, '/register (get)', e?.message || 'error');
	}

	return null;
};

// Extract user-creation-related POST paths from an OpenAPI/Swagger spec
const discoverPostPaths = (spec: unknown): string[] => {
	if (typeof spec !== 'object' || spec === null || !('paths' in spec)) return [];

	const pathsObj = (spec as any).paths;
	if (!pathsObj || typeof pathsObj !== 'object') return [];

	const paths: string[] = [];
	for (const [rawPath, methods] of Object.entries(pathsObj as Record<string, any>)) {
		const p = String(rawPath);
		const lowerP = p.toLowerCase();
		const hasPost = methods && (methods as any).post;
		if (!hasPost) continue;
		// Filter for paths related to user creation
		if (lowerP.includes('user') || lowerP.includes('register') || lowerP.includes('signup')) {
			paths.push(p);
		}
	}
	return paths;
};

const tryFromOpenApiSpec = async (
	apiContext: APIRequestContext,
	postPaths: string[],
	payload: CreatePayload,
	tried: TriedEntry[],
	successStatuses: number[]
): Promise<CreateResult> => {
	for (const p of postPaths) {
		const result = await tryCreateAtPath(apiContext, p, payload, tried, successStatuses);
		if (result) return result;
	}
	return null;
};

const tryOpenApiDiscovery = async (
	apiContext: APIRequestContext,
	payload: CreatePayload,
	tried: TriedEntry[]
): Promise<CreateResult> => {
	for (const docPath of OPENAPI_DOC_CANDIDATES) {
		try {
			const docRes = await apiContext.get(docPath);
			recordTry(tried, docPath, docRes.status());
			const contentType = docRes.headers()['content-type'] || '';
			const text = await docRes.text().catch(() => '');
			if (!text) continue;

			if (contentType.includes('application/json')) {
				let spec: unknown = null;
				try { spec = JSON.parse(text); } catch { spec = null; }
				const postPaths = discoverPostPaths(spec);
				const result = await tryFromOpenApiSpec(apiContext, postPaths, payload, tried, STRICT_SUCCESS_STATUSES);
				if (result) return result;
			}

			if (contentType.includes('html')) {
				const matches = Array.from(
					text.matchAll(/(["'])(?<href>[^"']+\.(?:json))(\1)/gi) as Iterable<RegExpMatchArray>
				)
					.map((m: RegExpMatchArray) => m.groups?.href)
					.filter(Boolean) as string[];
				const extra = ['/openapi.json', '/swagger.json', '/v3/api-docs', '/api/docs.json', '/api-docs'];
				const jsonCandidates = [...new Set([...matches, ...extra])];

				for (const candidate of jsonCandidates) {
					const tryPath = candidate.startsWith('http') ? new URL(candidate).pathname : candidate;
					try {
						const specRes = await apiContext.get(tryPath);
						recordTry(tried, tryPath, specRes.status());
						if (specRes.status() !== 200) continue;

						const specText = await specRes.text().catch(() => '');
						let spec: unknown = null;
						try { spec = JSON.parse(specText); } catch { spec = null; }
						const postPaths = discoverPostPaths(spec);
						const result = await tryFromOpenApiSpec(apiContext, postPaths, payload, tried, EXTENDED_SUCCESS_STATUSES);
						if (result) return result;
					} catch (e: unknown) {
						recordTry(tried, candidate, e?.message || 'error');
					}
				}
			}
		} catch (e: unknown) {
			recordTry(tried, docPath, e?.message || 'error');
		}
	}

	return null;
};

const tryUiRegisterFallback = async (
	browser: Browser,
	baseURL: string,
	payload: CreatePayload
): Promise<CreateResult> => {
	try {
		const page = await browser.newPage();
		const reg = new RegisterPage(page);
		await reg.goto(baseURL);
		const filledEmail = await reg.fillEmail(payload.email);
		const filledPassword = await reg.fillPassword(payload.password);
		if (filledEmail && filledPassword) {
			await reg.submit();
			// #message gets class="success" or class="error" synchronously once the
			// registration fetch() resolves (templates/register.html) - wait on that
			// instead of a fixed sleep, and only save credentials on confirmed success.
			const message = page.locator('#message');
			await expect(message).toHaveClass(/success|error/, { timeout: 5000 });
			const succeeded = (await message.getAttribute('class'))?.includes('success') ?? false;
			if (!succeeded) {
				await page.close();
				return null;
			}
			await page.close();
			return {
				response: {
					status: () => 200,
					json: async () => ({ email: payload.email })
				},
				path: 'ui-register-fallback'
			};
		}
		await page.close();
	} catch {
		// best-effort fallback only
	}
	return null;
};

// Discover and use the available user creation flow in priority order:
// 1. Try common API endpoints (form + JSON)
// 2. Fall back to HTML form parsing (/register GET, then POST)
// 3. Try OpenAPI/Swagger discovery (fetch docs, extract paths, try those)
// 4. Last resort: use UI automation via browser
export async function createUserViaAvailableFlow(
	apiContext: APIRequestContext,
	browser: Browser,
	baseURL: string,
	payload: CreatePayload
): Promise<{ result: CreateResult; tried: TriedEntry[] }> {
	const tried: TriedEntry[] = [];
	let result: CreateResult = null;

	// Step 1: Try common API registration endpoints
	for (const path of API_REGISTRATION_CANDIDATES) {
		result = await tryCreateAtPath(apiContext, path, payload, tried, STRICT_SUCCESS_STATUSES);
		if (result) return { result, tried };
	}

	// Step 2: Try HTML form fallback (GET /register, parse, POST)
	result = await tryRegisterHtmlFallback(apiContext, baseURL, payload, tried);
	if (result) return { result, tried };

	// Step 3: Try OpenAPI/Swagger discovery
	result = await tryOpenApiDiscovery(apiContext, payload, tried);
	if (result) return { result, tried };

	// Step 4: Last resort - UI automation
	result = await tryUiRegisterFallback(browser, baseURL, payload);
	return { result, tried };
}

const isNumericStatus = (status: number | string): status is number => typeof status === 'number';

const uniqueNumericStatuses = (tried: TriedEntry[]) =>
	[...new Set(tried.map(({ status }) => status).filter(isNumericStatus))];

const hasPathMatch = (tried: TriedEntry[], matcher: RegExp) =>
	tried.some(({ path }) => matcher.test(path));

export function analyzeCreateUserFailure(tried: TriedEntry[]): CreateUserFailureAnalysis {
	const statuses = uniqueNumericStatuses(tried);
	const statusStrings = tried
		.map(({ status }) => status)
		.filter((status): status is string => typeof status === 'string');

	const hasServerError = statuses.some((status) => status >= 500);
	const hasAuthDenied = statuses.some((status) => status === 401 || status === 403);
	const hasContractMismatch = statuses.some((status) => [400, 405, 415, 422].includes(status));
	const hasOnlyNotFoundStyleStatuses =
		statuses.length > 0 && statuses.every((status) => [404, 405].includes(status));
	const hasTransportError = statusStrings.length > 0;
	const attemptedDocs = hasPathMatch(tried, /(openapi|swagger|api-docs|docs\.json)/i);
	const attemptedRegistration = hasPathMatch(tried, /(register|signup|users)/i);

	if (hasAuthDenied) {
		return {
			category: 'API2:2023 - Broken Authentication',
			description: 'User creation routes were found, but access to the registration flow was denied by authentication or authorization controls.',
			recommendations: [
				'Allow the intended registration flow to be exercised without requiring an already-authenticated session unless that requirement is explicitly documented.',
				'Document which registration endpoints are public versus protected and what credentials or roles are required.',
				'Verify the registration and login flow is wired consistently across API, HTML form, and UI entry points.'
			]
		};
	}

	if (hasServerError || hasTransportError) {
		return {
			category: 'API8:2023 - Security Misconfiguration',
			description: 'The registration capability appears to be deployed inconsistently or failing operationally, with server-side or transport-level errors preventing account creation.',
			recommendations: [
				'Review application and reverse-proxy logs for the failing registration routes and fix the underlying runtime errors.',
				'Ensure the registration endpoints are enabled and configured consistently across environments used for automated testing.',
				'Add health checks or smoke tests that verify the registration path is reachable before running deeper API security checks.'
			]
		};
	}

	if (hasContractMismatch && attemptedRegistration) {
		return {
			category: 'API8:2023 - Security Misconfiguration',
			description: 'A registration endpoint appears to exist, but it rejects the attempted request formats or methods, suggesting a contract or routing misconfiguration.',
			recommendations: [
				'Standardize the supported registration method and payload shape, and keep form and JSON handling aligned.',
				'Return clear validation errors and content-type expectations for registration requests.',
				'Keep the implemented registration contract synchronized with automated tests and published API documentation.'
			]
		};
	}

	if (attemptedDocs || hasOnlyNotFoundStyleStatuses) {
		return {
			category: 'API9:2023 - Improper Inventory Management',
			description: 'No stable, discoverable user-creation route could be identified through common endpoints, registration pages, or API documentation.',
			recommendations: [
				'Expose and document a stable registration endpoint for test and automation environments.',
				'Support at least one standard payload format for account creation and document it clearly.',
				'Ensure registration routes are included in OpenAPI or Swagger documentation when available.'
			]
		};
	}

	return {
		category: 'API8:2023 - Security Misconfiguration',
		description: 'User creation could not be completed because the available registration paths behaved inconsistently across discovery and fallback flows.',
		recommendations: [
			'Review the registration flow end-to-end and remove inconsistent behavior between API, HTML, and UI paths.',
			'Publish a single supported registration contract and validate it in CI.',
			'Capture and review response bodies for failing registration attempts to narrow the configuration gap.'
		]
	};
}

export function analyzeCreateUserSuccess(result: NonNullable<CreateResult>): CreateUserSuccessAnalysis {
	const path = result.path.toLowerCase();
	const status = result.response.status();

	if (path.includes('ui-register-fallback')) {
		return {
			category: 'API9:2023 - Improper Inventory Management',
			description: 'User creation succeeded only through the UI fallback flow, which suggests the API registration surface is not reliably discoverable for automation.'
		};
	}

	if (path.includes('register') || path.includes('signup') || path.includes('auth')) {
		return {
			category: 'API2:2023 - Broken Authentication',
			description: `User creation flow completed successfully through a registration path with status ${status}.`
		};
	}

	if (path.includes('users')) {
		return {
			category: 'API6:2023 - Unrestricted Access to Sensitive Business Flows',
			description: `User provisioning completed successfully through a user-management endpoint with status ${status}.`
		};
	}

	return {
		category: 'API9:2023 - Improper Inventory Management',
		description: `User creation completed successfully, but only through a non-standard or fallback-discovered path with status ${status}.`
	};
}
