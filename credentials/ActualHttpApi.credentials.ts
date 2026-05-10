import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Must stay aligned with normalizeActualHttpApiBaseUrl in nodes/ActualBudget/actualHttpApiRoot.ts.
 * Hardened for credential Test: null-safe baseUrl, default host when empty, outer catch → valid URL.
 */
const credentialTestBaseUrlExpression =
	'={{ (() => { try { let raw = ($credentials.baseUrl ?? "").trim().replace(/\\/+$/, ""); if (!raw) raw = "http://localhost:5007"; const trimmed = raw.replace(/\\/+$/, ""); try { const u = new URL(trimmed); let path = u.pathname.replace(/\\/+$/, ""); if (path === "") path = "/"; if (path === "/") { u.pathname = "/v1"; } else if (path.endsWith("/v1")) { u.pathname = path; } else { return trimmed; } return (u.origin + u.pathname).replace(/\\/+$/, ""); } catch { return trimmed; } } catch { return "http://localhost:5007/v1"; } })() }}';

export class ActualHttpApi implements ICredentialType {
	name = 'actualHttpApi';

	displayName = 'Actual HTTP API';

	icon: Icon = {
		light: 'file:../nodes/ActualBudget/actual-budget.svg',
		dark: 'file:../nodes/ActualBudget/actual-budget.dark.svg',
	};

	documentationUrl = 'https://github.com/jhonderson/actual-http-api';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://localhost:5007',
			placeholder: 'http://actual-http-api:5007/v1',
			required: true,
			description:
				'Root URL of actual-http-api (host and port). If you omit the path (e.g. http://myapi:5007), /v1 is added automatically. You may also set the full URL including /v1.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key configured in actual-http-api as API_KEY',
		},
		{
			displayName: 'Budget Sync ID',
			name: 'budgetSyncId',
			type: 'string',
			default: '',
			required: true,
			description:
				'Synchronization ID from Actual Budget settings under Show advanced settings',
		},
		{
			displayName: 'Budget Encryption Password',
			name: 'budgetEncryptionPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Optional password for end-to-end encrypted Actual budgets',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
				'budget-encryption-password': '={{$credentials.budgetEncryptionPassword}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: credentialTestBaseUrlExpression,
			url: '=/budgets/{{$credentials.budgetSyncId}}/accounts',
			method: 'GET',
		},
	};
}
