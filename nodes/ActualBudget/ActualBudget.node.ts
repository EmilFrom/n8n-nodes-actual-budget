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

type ActualCategoryGroup = {
	name: string;
	hidden?: boolean;
	categories?: ActualCategory[];
};

type ActualPayee = {
	id: string;
	name: string;
};

const showForImportTransaction = {
	resource: ['transaction'],
	operation: ['import'],
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

function decimalToActualAmount(value: number, transactionType: string) {
	if (!Number.isFinite(value) || value <= 0) {
		throw new ApplicationError('Amount must be a positive number');
	}

	const unsignedAmount = Math.round(value * 100);
	return transactionType === 'expense' ? -unsignedAmount : unsignedAmount;
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
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Import income and expenses into Actual Budget via actual-http-api',
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
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Transaction',
						value: 'transaction',
					},
				],
				default: 'transaction',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
					},
				},
				options: [
					{
						name: 'Import Expense/Income',
						value: 'import',
						action: 'Import an income or expense transaction',
						description: 'Import one transaction using Actual import dedupe behavior',
					},
				],
				default: 'import',
			},
			{
				displayName: 'Account',
				name: 'accountId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: showForImportTransaction,
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
				description: 'Actual account to import the transaction into',
			},
			{
				displayName: 'Transaction Type',
				name: 'transactionType',
				type: 'options',
				displayOptions: {
					show: showForImportTransaction,
				},
				options: [
					{
						name: 'Expense',
						value: 'expense',
					},
					{
						name: 'Income',
						value: 'income',
					},
				],
				default: 'expense',
				description: 'Whether the positive amount should be imported as money out or money in',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'number',
				required: true,
				displayOptions: {
					show: showForImportTransaction,
				},
				typeOptions: {
					minValue: 0,
					numberPrecision: 2,
				},
				default: 0,
				description: 'Positive decimal amount, for example 12.34',
			},
			{
				displayName: 'Date',
				name: 'date',
				type: 'dateTime',
				required: true,
				displayOptions: {
					show: showForImportTransaction,
				},
				default: '',
				description: 'Transaction date. Actual stores transactions by date, so time is ignored.',
			},
			{
				displayName: 'Transaction UUID',
				name: 'transactionUuid',
				type: 'string',
				required: true,
				displayOptions: {
					show: showForImportTransaction,
				},
				default: '',
				description: 'Stable transaction identifier to send as imported_id for dedupe/upsert behavior',
			},
			{
				displayName: 'Payee',
				name: 'payeeName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: showForImportTransaction,
				},
				modes: [
					{
						displayName: 'Payee',
						name: 'list',
						type: 'list',
						placeholder: 'Select a payee...',
						typeOptions: {
							searchListMethod: 'getPayees',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: 'e.g. Grocery Store',
					},
				],
				description: 'Existing payee to use, or a payee name for Actual to match/create',
			},
			{
				displayName: 'Category',
				name: 'categoryId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: showForImportTransaction,
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
				description: 'Actual category for the transaction',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: showForImportTransaction,
				},
				options: [
					{
						displayName: 'Cleared',
						name: 'cleared',
						type: 'boolean',
						default: true,
						description: 'Whether this transaction should be marked as cleared',
					},
					{
						displayName: 'Notes',
						name: 'notes',
						type: 'string',
						typeOptions: {
							rows: 3,
						},
						default: '',
						description: 'Optional transaction notes',
					},
				],
			},
			{
				displayName: 'Import Options',
				name: 'importOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: showForImportTransaction,
				},
				options: [
					{
						displayName: 'Default Cleared',
						name: 'defaultCleared',
						type: 'boolean',
						default: true,
						description: 'Whether imported transactions should default to cleared',
					},
					{
						displayName: 'Dry Run',
						name: 'dryRun',
						type: 'boolean',
						default: false,
						description: 'Whether to preview import results without changing the budget',
					},
					{
						displayName: 'Reimport Deleted',
						name: 'reimportDeleted',
						type: 'boolean',
						default: false,
						description: 'Whether to reimport transactions previously deleted in Actual',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			getAccounts,
			getCategories,
			getPayees,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const accountId = this.getNodeParameter('accountId', itemIndex, '', {
					extractValue: true,
				}) as string;
				const categoryId = this.getNodeParameter('categoryId', itemIndex, '', {
					extractValue: true,
				}) as string;
				const payeeName = this.getNodeParameter('payeeName', itemIndex, '', {
					extractValue: true,
				}) as string;
				const transactionType = this.getNodeParameter(
					'transactionType',
					itemIndex,
				) as string;
				const amount = this.getNodeParameter('amount', itemIndex) as number;
				const date = this.getNodeParameter('date', itemIndex) as string;
				const transactionUuid = this.getNodeParameter(
					'transactionUuid',
					itemIndex,
				) as string;
				const additionalFields = this.getNodeParameter(
					'additionalFields',
					itemIndex,
					{},
				) as IDataObject;
				const importOptions = this.getNodeParameter(
					'importOptions',
					itemIndex,
					{},
				) as IDataObject;

				const transaction: IDataObject = {
					account: accountId,
					amount: decimalToActualAmount(amount, transactionType),
					category: categoryId,
					date: parseActualDate(date),
					imported_id: transactionUuid,
					payee_name: payeeName,
				};

				if (additionalFields.notes) {
					transaction.notes = additionalFields.notes;
				}

				if (additionalFields.cleared !== undefined) {
					transaction.cleared = additionalFields.cleared;
				}

				const responseData = (await actualApiRequest.call(
					this,
					'POST',
					`/accounts/${encodeURIComponent(accountId)}/transactions/import`,
					{
						transactions: [transaction],
						defaultCleared: importOptions.defaultCleared ?? true,
						dryRun: importOptions.dryRun ?? false,
						reimportDeleted: importOptions.reimportDeleted ?? false,
					},
				)) as IDataObject;

				returnData.push({
					json: {
						...responseData,
						transaction,
					},
					pairedItem: itemIndex,
				});
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
	const response = (await actualApiRequest.call(
		this,
		'GET',
		'/categorygroups',
	)) as ActualListResponse<ActualCategoryGroup>;
	const results: INodeListSearchItems[] = [];

	for (const group of response.data ?? []) {
		if (group.hidden) {
			continue;
		}

		for (const category of group.categories ?? []) {
			if (category.hidden) {
				continue;
			}

			results.push({
				name: `${group.name} / ${category.name}`,
				value: category.id,
			});
		}
	}

	return { results: filterResults(results, filter) };
}

async function getPayees(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = (await actualApiRequest.call(this, 'GET', '/payees')) as ActualListResponse<
		ActualPayee
	>;
	const payees = filterResults(response.data ?? [], filter);

	const results: INodeListSearchItems[] = payees.map((payee) => ({
		name: payee.name,
		value: payee.name,
	}));

	return { results };
}
