import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeListSearchItems,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { ApplicationError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { actualApiRequest } from './transport';

type ActualListResponse<T> = {
	data?: T[];
};

type ActualAccount = {
	id: string;
	name: string;
	closed?: boolean;
};

type ActualCategory = {
	id: string;
	name: string;
	hidden?: boolean;
};

/** Single-transaction create (official POST body). */
const showForTransactionCreate = {
	action: ['transactionCreate'],
};

/** GET /months/{month} */
const showForBudgetGet = {
	action: ['budgetGet'],
};

function parseActualDate(value: string) {
	const rawDate = value.trim();
	const dateMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);

	if (dateMatch) {
		return dateMatch[1];
	}

	const parsedDate = new Date(rawDate);
	if (Number.isNaN(parsedDate.getTime())) {
		throw new ApplicationError('Date must be a valid date or date-time value');
	}

	return parsedDate.toISOString().slice(0, 10);
}

function parseMinorUnitsAmount(value: number) {
	if (!Number.isFinite(value)) {
		throw new ApplicationError(
			'Amount must be an integer in minor currency units (e.g. -7374 for -73.74)',
		);
	}

	const rounded = Math.round(value);
	if (Math.abs(value - rounded) > 1e-9) {
		throw new ApplicationError(
			'Amount must be an integer in minor currency units (e.g. -7374 for -73.74)',
		);
	}

	return rounded;
}

function filterResults<T extends { name: string }>(items: T[], filter?: string) {
	if (!filter) {
		return items;
	}

	const normalizedFilter = filter.toLowerCase();
	return items.filter((item) => item.name.toLowerCase().includes(normalizedFilter));
}

export class ActualBudget implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Actual Budget',
		name: 'actualBudget',
		icon: { light: 'file:actual-budget.svg', dark: 'file:actual-budget.dark.svg' },
		group: ['input'],
		version: 2,
		subtitle: '={{$parameter["action"]}}',
		description:
			'Read budgets and create transactions in Actual Budget via actual-http-api (official endpoints)',
		defaults: {
			name: 'Actual Budget',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'actualHttpApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Action',
				name: 'action',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account: List',
						value: 'accountList',
						action: 'List accounts',
						description: 'GET /accounts',
					},
					{
						name: 'Budget: Get Month',
						value: 'budgetGet',
						action: 'Get budget month',
						description: 'GET /months/{month}',
					},
					{
						name: 'Category: List',
						value: 'categoryList',
						action: 'List categories',
						description: 'GET /categories',
					},
					{
						name: 'Transaction: Create',
						value: 'transactionCreate',
						action: 'Create a transaction',
						description: 'POST /accounts/{ID}/transactions',
					},
				],
				default: 'transactionCreate',
			},
			{
				displayName: 'Account',
				name: 'accountId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: showForTransactionCreate,
				},
				modes: [
					{
						displayName: 'Account',
						name: 'list',
						type: 'list',
						placeholder: 'Select an account...',
						typeOptions: {
							searchListMethod: 'getAccounts',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 729cb492-4eab-468b-9522-75d455cded22',
					},
				],
				description: 'Account for the transaction',
			},
			{
				displayName: 'Category',
				name: 'categoryId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: showForTransactionCreate,
				},
				modes: [
					{
						displayName: 'Category',
						name: 'list',
						type: 'list',
						placeholder: 'Select a category...',
						typeOptions: {
							searchListMethod: 'getCategories',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 9fa2550c-c3ff-498b-8df6-e0fbe2a62e0e',
					},
				],
				description: 'Category ID for the transaction',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'number',
				required: true,
				displayOptions: {
					show: showForTransactionCreate,
				},
				typeOptions: {
					numberPrecision: 0,
				},
				default: 0,
				description: 'Integer minor units (see actual-http-api docs). Example: expense -7374 means -73.74.',
			},
			{
				displayName: 'Date',
				name: 'date',
				type: 'dateTime',
				required: true,
				displayOptions: {
					show: showForTransactionCreate,
				},
				default: '',
				description: 'Transaction date (YYYY-MM-DD); time is ignored',
			},
			{
				displayName: 'Payee Name',
				name: 'payeeName',
				type: 'string',
				required: true,
				displayOptions: {
					show: showForTransactionCreate,
				},
				default: '',
				placeholder: 'e.g. Amazon',
				description: 'Payee label for the transaction',
			},
			{
				displayName: 'Cleared',
				name: 'cleared',
				type: 'boolean',
				displayOptions: {
					show: showForTransactionCreate,
				},
				default: false,
				description: 'Whether the transaction is cleared',
			},
			{
				displayName: 'Learn Categories',
				name: 'learnCategories',
				type: 'boolean',
				displayOptions: {
					show: showForTransactionCreate,
				},
				default: false,
				description: 'Whether to pass learnCategories to actual-http-api',
			},
			{
				displayName: 'Run Transfers',
				name: 'runTransfers',
				type: 'boolean',
				displayOptions: {
					show: showForTransactionCreate,
				},
				default: false,
				description: 'Whether to pass runTransfers to actual-http-api',
			},
			{
				displayName: 'Month',
				name: 'month',
				type: 'string',
				required: true,
				displayOptions: {
					show: showForBudgetGet,
				},
				default: '',
				placeholder: '2026-05',
				description: 'Budget month in YYYY-MM format',
			},
		],
	};

	methods = {
		listSearch: {
			getAccounts,
			getCategories,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const action = this.getNodeParameter('action', itemIndex) as string;

				if (action === 'transactionCreate') {
					const accountId = this.getNodeParameter('accountId', itemIndex, '', {
						extractValue: true,
					}) as string;
					const categoryId = this.getNodeParameter('categoryId', itemIndex, '', {
						extractValue: true,
					}) as string;
					const amount = parseMinorUnitsAmount(this.getNodeParameter('amount', itemIndex) as number);
					const date = this.getNodeParameter('date', itemIndex) as string;
					const payeeName = this.getNodeParameter('payeeName', itemIndex) as string;
					const cleared = this.getNodeParameter('cleared', itemIndex, false) as boolean;
					const learnCategories = this.getNodeParameter(
						'learnCategories',
						itemIndex,
						false,
					) as boolean;
					const runTransfers = this.getNodeParameter('runTransfers', itemIndex, false) as boolean;

					const body: IDataObject = {
						learnCategories,
						runTransfers,
						transaction: {
							account: accountId,
							category: categoryId,
							amount,
							payee_name: payeeName,
							date: parseActualDate(date),
							cleared,
						},
					};

					const responseData = (await actualApiRequest.call(
						this,
						'POST',
						`/accounts/${encodeURIComponent(accountId)}/transactions`,
						body,
					)) as IDataObject;

					returnData.push({
						json: {
							...responseData,
							request: body,
						},
						pairedItem: itemIndex,
					});
					continue;
				}

				if (action === 'budgetGet') {
					const month = this.getNodeParameter('month', itemIndex) as string;
					const trimmed = month.trim();
					if (!/^\d{4}-\d{2}$/.test(trimmed)) {
						throw new ApplicationError('Month must be in YYYY-MM format');
					}

					const response = (await actualApiRequest.call(
						this,
						'GET',
						`/months/${encodeURIComponent(trimmed)}`,
					)) as IDataObject;

					returnData.push({
						json: response as IDataObject,
						pairedItem: itemIndex,
					});
					continue;
				}

				if (action === 'accountList') {
					const response = (await actualApiRequest.call(this, 'GET', '/accounts')) as IDataObject;
					returnData.push({
						json: response as IDataObject,
						pairedItem: itemIndex,
					});
					continue;
				}

				if (action === 'categoryList') {
					const response = (await actualApiRequest.call(this, 'GET', '/categories')) as IDataObject;
					returnData.push({
						json: response as IDataObject,
						pairedItem: itemIndex,
					});
					continue;
				}

				throw new ApplicationError(`Unsupported action: ${action}`);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						pairedItem: itemIndex,
					});
					continue;
				}

				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex,
				});
			}
		}

		return [returnData];
	}
}

async function getAccounts(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = (await actualApiRequest.call(this, 'GET', '/accounts')) as ActualListResponse<
		ActualAccount
	>;
	const accounts = filterResults(response.data ?? [], filter).filter((account) => !account.closed);

	const results: INodeListSearchItems[] = accounts.map((account) => ({
		name: account.name,
		value: account.id,
	}));

	return { results };
}

async function getCategories(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = (await actualApiRequest.call(this, 'GET', '/categories')) as ActualListResponse<
		ActualCategory
	>;
	const visible = (response.data ?? []).filter((c) => !c.hidden);
	const results: INodeListSearchItems[] = visible.map((category) => ({
		name: category.name,
		value: category.id,
	}));

	return { results: filterResults(results, filter) };
}
