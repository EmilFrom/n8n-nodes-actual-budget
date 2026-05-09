import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

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
			placeholder: 'http://actual-http-api:5007',
			required: true,
			description: 'Base URL of the actual-http-api service, without a trailing slash',
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
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '=/budgets/{{$credentials.budgetSyncId}}/accounts',
			method: 'GET',
		},
	};
}
