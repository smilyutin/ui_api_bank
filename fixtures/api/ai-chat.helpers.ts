import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * AI Customer Support Chat Helpers
 *
 * Supports API tests for the AI chat surfaces:
 * - `POST /api/ai/chat`               (authenticated, @ai_rate_limit + @token_required)
 * - `POST /api/ai/chat/anonymous`     (unauthenticated, @ai_rate_limit)
 * - `GET  /api/ai/system-info`        (unauthenticated, @ai_rate_limit)
 * - `GET  /api/ai/chat-logs`          (unauthenticated, @ai_rate_limit; optional ?user_id=)
 * - `GET  /api/ai/rate-limit-status`  (unauthenticated, NOT rate-limited itself)
 *
 * The agent behind `/api/ai/chat*` is `FakeLLMAgent` (app.py) — a deterministic
 * local rule-based agent (no external LLM/API key) that reproduces the root
 * cause of prompt injection: its system prompt and the caller's message are
 * concatenated with no structural boundary before pattern-matching. See
 * `tests/api/ai-chat.spec.ts` for the exploitable scenarios this enables.
 *
 * The rate limiter (`ai_rate_limit` in app.py) is a single in-memory dict keyed
 * by client IP, shared across every test/run with no reset endpoint
 * (UNAUTHENTICATED_LIMIT=5, AUTHENTICATED_LIMIT=10, per 3h window). Rather than
 * hardcode "N remaining" assumptions, tests that are about to make a real
 * chat/system-info call should query `/api/ai/rate-limit-status` live first
 * (it is not itself rate-limited) via `getChatBudget`/`hasChatBudgetRemaining`,
 * the same way `discoverBiller()` queries the live catalog instead of
 * hardcoding seed ids.
 */

export type AiToolCall = Record<string, unknown> & { tool: string };

export type AiChatResponseBody = {
	status: 'success' | 'error';
	ai_response?: {
		response: string;
		echo: string;
		has_user_context: boolean;
		context: Record<string, unknown>;
		jailbroken: boolean;
		tool_calls: AiToolCall[];
		formatted_html: string | null;
	};
	mode?: 'authenticated' | 'anonymous';
	user_context_included?: boolean;
	warning?: string;
	message?: string;
	system_info?: { provider: string; model: string; model_version: string; note: string };
};

export type SystemInfoResponseBody = {
	status: 'success' | 'error';
	system_info?: { provider: string; model: string; model_version: string; note: string };
	endpoints?: Record<string, string>;
	modes?: Record<string, string>;
	vulnerabilities?: string[];
	demo_attacks?: string[];
};

export type ChatLogEntry = {
	id: number;
	user_id: number | null;
	mode: string;
	user_message: string;
	jailbroken: boolean;
	tool_calls: AiToolCall[];
	ai_response: string;
	created_at: string;
};

export type ChatLogsResponseBody = {
	status: 'success' | 'error';
	chat_logs?: ChatLogEntry[];
	message?: string;
};

export type RateLimitStatusBody = {
	status: 'success' | 'error';
	client_ip?: string;
	rate_limits?: {
		unauthenticated: { limit: number; window_hours: number; requests_made: number; remaining?: number };
		authenticated: {
			limit: number;
			window_hours: number;
			user_requests_made: number;
			ip_requests_made: number;
			user_remaining?: number;
			ip_remaining?: number;
		};
	};
	authenticated_user?: { user_id: number; username: string };
};

export async function chatAuthenticated(api: APIRequestContext, token: string, message: string): Promise<APIResponse> {
	return api.post('/api/ai/chat', {
		headers: { Authorization: `Bearer ${token}` },
		data: { message }
	});
}

export async function chatAnonymous(api: APIRequestContext, message: string): Promise<APIResponse> {
	return api.post('/api/ai/chat/anonymous', { data: { message } });
}

export async function getSystemInfo(api: APIRequestContext): Promise<APIResponse> {
	return api.get('/api/ai/system-info');
}

export async function getChatLogs(api: APIRequestContext, userId?: number | string): Promise<APIResponse> {
	const query = userId !== undefined ? `?user_id=${encodeURIComponent(String(userId))}` : '';
	return api.get(`/api/ai/chat-logs${query}`);
}

export async function getRateLimitStatus(
	api: APIRequestContext,
	token?: string,
	spoofedIp?: string
): Promise<APIResponse> {
	const headers: Record<string, string> = {};
	if (token) headers['Authorization'] = `Bearer ${token}`;
	if (spoofedIp) headers['X-Forwarded-For'] = spoofedIp;
	return api.get('/api/ai/rate-limit-status', { headers });
}

export type ChatBudget = {
	anonymousRemaining: number;
	authenticatedUserRemaining: number | null;
	authenticatedIpRemaining: number | null;
};

/**
 * Queries the free rate-limit-status endpoint to check real remaining budget
 * before a test makes a real chat/system-info call.
 */
export async function getChatBudget(api: APIRequestContext, token?: string): Promise<ChatBudget | null> {
	const res = await getRateLimitStatus(api, token);
	if (res.status() !== 200) return null;
	const body = (await res.json().catch(() => null)) as RateLimitStatusBody | null;
	if (!body?.rate_limits) return null;
	return {
		anonymousRemaining: body.rate_limits.unauthenticated.remaining ?? 0,
		authenticatedUserRemaining: token ? body.rate_limits.authenticated.user_remaining ?? 0 : null,
		authenticatedIpRemaining: token ? body.rate_limits.authenticated.ip_remaining ?? 0 : null
	};
}

export function hasChatBudgetRemaining(budget: ChatBudget | null, kind: 'anonymous' | 'authenticated'): boolean {
	if (!budget) return false;
	if (kind === 'anonymous') return budget.anonymousRemaining >= 1;
	return (budget.authenticatedUserRemaining ?? 0) >= 1 && (budget.authenticatedIpRemaining ?? 0) >= 1;
}
