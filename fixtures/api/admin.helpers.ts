import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Admin Helpers
 *
 * Supports API tests for the admin surfaces:
 * - `GET /sup3r_s3cr3t_admin`           (admin only)
 * - `POST /admin/create_admin`          (admin only)
 * - `POST /admin/delete_account/<id>`   (admin only)
 */

export async function createAdmin(
	api: APIRequestContext,
	token: string,
	payload: { username: string; password: string; account_number: string }
): Promise<APIResponse> {
	return api.post('/admin/create_admin', {
		headers: { Authorization: `Bearer ${token}` },
		data: payload
	});
}

export async function deleteAccount(api: APIRequestContext, token: string, userId: number): Promise<APIResponse> {
	return api.post(`/admin/delete_account/${userId}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
}
