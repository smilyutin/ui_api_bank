/**
 * Register Form Helpers
 *
 * Parses HTML registration forms and builds form submissions (action, fields,
 * headers) that tests can POST back to complete registration. Used by login
 * and create-user flows when API endpoints don't exist or aren't discoverable.
 *
 * `buildRegisterFormSubmission` extracts:
 * - The form's action path from <form action="...">
 * - All input fields (with and without default values)
 * - Common field name patterns for email/username/password (flexible to handle
 *   naming variations: `email`, `user[email]`, `email_address`, etc.)
 * - Sets Referer and Origin headers to match the base URL
 */

export type RegisterFormPayload = {
	identifier?: string;
	email?: string;
	username?: string;
	password: string;
};

export type RegisterFormSubmission = {
	actionPath: string;
	formBody: Record<string, string>;
	headers: Record<string, string>;
};

// Common field name patterns in HTML registration forms (accommodate variations)
const EMAIL_KEYS = ['email', 'username', 'user', 'email_address', 'user[email]'];
const PASSWORD_KEYS = ['password', 'pass', 'user[password]'];

// Resolve email value, falling back to identifier/username if email not provided
const resolveEmailValue = (payload: RegisterFormPayload) =>
	payload.email || payload.identifier || payload.username || '';

// Resolve username value, falling back to identifier/email if username not provided
const resolveUsernameValue = (payload: RegisterFormPayload) =>
	payload.username || payload.identifier || payload.email || '';

export function buildRegisterFormSubmission(
	html: string,
	payload: RegisterFormPayload,
	baseURL?: string
): RegisterFormSubmission {
	// Extract form action path and form HTML from the page
	const formMatch = html.match(/<form[^>]*action=["'](?<action>[^"']+)["'][^>]*>([\s\S]*?)<\/form>/i);
	let actionPath = '/register';
	let formInner = html;

	if (formMatch?.groups) {
		actionPath = formMatch.groups['action'] || actionPath;
		formInner = formMatch[0];
	}

	// Parse all input fields from the form (with and without default values)
	const inputs: Record<string, string> = {};
	const withValue = /<input[^>]*name=["'](?<name>[^"']+)["'][^>]*value=["'](?<value>[^"']*)["'][^>]*>/gi;
	const withoutValue = /<input[^>]*name=["'](?<name>[^"']+)["'][^>]*>/gi;

	let match: RegExpExecArray | null;
	while ((match = withValue.exec(formInner)) !== null) {
		if (match.groups?.name) {
			inputs[match.groups.name] = match.groups.value || '';
		}
	}
	// Add inputs without values, but skip if already captured with a value
	while ((match = withoutValue.exec(formInner)) !== null) {
		if (match.groups?.name && !(match.groups.name in inputs)) {
			inputs[match.groups.name] = '';
		}
	}

	const formBody: Record<string, string> = {};
	for (const key of Object.keys(inputs)) {
		formBody[key] = inputs[key] || '';
	}

	// Fill in email/username/identifier fields with the provided payload
	for (const key of EMAIL_KEYS) {
		if (key in formBody) {
			// 'username' and 'user' fields get the username value, others get email
			if (key === 'username' || key === 'user') {
				formBody[key] = resolveUsernameValue(payload);
			} else {
				formBody[key] = resolveEmailValue(payload);
			}
		}
	}
	// Fill in password field (stop at first match to avoid overwriting)
	for (const key of PASSWORD_KEYS) {
		if (key in formBody) {
			formBody[key] = payload.password;
			break;
		}
	}

	// Extract pathname from absolute URLs (keep relative paths as-is)
	try {
		if (actionPath.startsWith('http')) {
			actionPath = new URL(actionPath).pathname;
		}
	} catch {}

	// Set Referer and Origin headers if baseURL is provided (some apps validate these)
	const headers: Record<string, string> = {};
	if (baseURL) {
		try {
			headers['Referer'] = new URL('/register', baseURL).toString();
		} catch {}
		try {
			headers['Origin'] = baseURL;
		} catch {}
	}

	return { actionPath, formBody, headers };
}
