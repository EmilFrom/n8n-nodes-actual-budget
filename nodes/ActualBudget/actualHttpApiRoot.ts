/**
 * Normalizes the credential Base URL for actual-http-api.
 * OpenAPI default server is `{protocol}://{host}:{port}/v1`; host-only URLs must include `/v1`.
 *
 * Keep in sync with the expression in ActualHttpApi.credentials.ts `test.request.baseURL`.
 */
export function normalizeActualHttpApiBaseUrl(raw: string): string {
	const trimmed = raw.trim().replace(/\/+$/, '');
	try {
		const u = new URL(trimmed);
		let path = u.pathname.replace(/\/+$/, '');
		if (path === '') {
			path = '/';
		}
		if (path === '/') {
			u.pathname = '/v1';
		} else if (path.endsWith('/v1')) {
			u.pathname = path;
		} else {
			return trimmed;
		}
		return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
	} catch {
		return trimmed;
	}
}
