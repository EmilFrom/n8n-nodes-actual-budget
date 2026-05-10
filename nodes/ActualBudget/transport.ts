import type {
	IDataObject,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { LoggerProxy as Logger } from 'n8n-workflow';
import { normalizeActualHttpApiBaseUrl } from './actualHttpApiRoot';

type ActualCredentials = {
	baseUrl: string;
	budgetSyncId: string;
};

type ActualRequestContext =
	| IExecuteFunctions
	| IExecuteSingleFunctions
	| IHookFunctions
	| ILoadOptionsFunctions;

function buildUrl(credentials: ActualCredentials, resource: string) {
	const apiRoot = normalizeActualHttpApiBaseUrl(credentials.baseUrl);
	const budgetSyncId = encodeURIComponent(credentials.budgetSyncId);
	const normalizedResource = resource.startsWith('/') ? resource : `/${resource}`;

	return `${apiRoot}/budgets/${budgetSyncId}${normalizedResource}`;
}

/** Sync ID segment replaced so logs are safe to share (no secrets). */
function redactBudgetSyncInUrl(url: string): string {
	return url.replace(/\/budgets\/[^/?#]+/, '/budgets/_syncId_');
}

export async function actualApiRequest(
	this: ActualRequestContext,
	method: IHttpRequestMethods,
	resource: string,
	body?: IDataObject,
	qs: IDataObject = {},
) {
	const credentials = (await this.getCredentials('actualHttpApi')) as ActualCredentials;

	const options: IHttpRequestOptions = {
		method,
		url: buildUrl(credentials, resource),
		qs,
		body,
		json: true,
	};

	const redactedUrl = redactBudgetSyncInUrl(options.url ?? '');
	const normalizedRoot = normalizeActualHttpApiBaseUrl(credentials.baseUrl);

	Logger.info('Actual Budget: HTTP request', {
		nodeType: 'actualBudget',
		method,
		resource,
		url: redactedUrl,
	});

	Logger.debug('Actual Budget: HTTP request (credential shape hints)', {
		nodeType: 'actualBudget',
		method,
		resource,
		url: redactedUrl,
		baseUrlEndsWithBudgetsPath: /\/budgets(\/|$)/i.test(normalizedRoot),
		budgetSyncIdTrimLength: String(credentials.budgetSyncId ?? '').trim().length,
	});

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'actualHttpApi', options);
	} catch (error: unknown) {
		const err = error as {
			statusCode?: number;
			message?: string;
			error?: unknown;
		};
		const troubleshootingHint =
			err.statusCode === 404
				? 'HTTP 404: verify Budget Sync ID matches Actual for this server; confirm actual-http-api uses /v1 routes; from Docker use service hostname not localhost.'
				: undefined;
		Logger.warn('Actual Budget: HTTP request failed', {
			nodeType: 'actualBudget',
			method,
			resource,
			url: redactedUrl,
			statusCode: err.statusCode,
			message: err.message,
			...(troubleshootingHint ? { troubleshootingHint } : {}),
		});
		throw error;
	}
}
