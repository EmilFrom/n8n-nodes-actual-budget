import type {
	IDataObject,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

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
	const baseUrl = credentials.baseUrl.replace(/\/+$/, '');
	const budgetSyncId = encodeURIComponent(credentials.budgetSyncId);
	const normalizedResource = resource.startsWith('/') ? resource : `/${resource}`;

	return `${baseUrl}/budgets/${budgetSyncId}${normalizedResource}`;
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

	return this.helpers.httpRequestWithAuthentication.call(this, 'actualHttpApi', options);
}
