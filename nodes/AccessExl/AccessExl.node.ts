import type {
	IDataObject,
	JsonObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ResourceMapperFields,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	fieldsFromProperties,
	valuesFromMapper,
	type JsonSchemaProperty,
	type MapperParameter,
} from './shared/fields';
import { accessExlRequest, tablePath } from './shared/transport';

interface SchemaResponse {
	schema?: { properties?: Record<string, JsonSchemaProperty> };
}

interface TablesResponse {
	tables?: Array<{ name: string }>;
}

async function listTables(context: ILoadOptionsFunctions, kind: 'writable' | 'readable'): Promise<INodePropertyOptions[]> {
	const response = (await accessExlRequest(context, 'GET', `/schema/tables/${kind}`)) as TablesResponse;
	return (response.tables ?? []).map((table) => ({ name: table.name, value: table.name }));
}

async function inputProperties(context: IExecuteFunctions | ILoadOptionsFunctions) {
	const response = (await accessExlRequest(context, 'GET', '/schema/input-schema')) as SchemaResponse;
	return response.schema?.properties ?? {};
}

async function rowProperties(context: IExecuteFunctions | ILoadOptionsFunctions, tableName: string) {
	const path = `/schema/tables/${encodeURIComponent(tableName)}/row-schema`;
	const response = (await accessExlRequest(context, 'GET', path, undefined, { body: 'row' })) as {
		schema?: { properties?: { row?: { properties?: Record<string, JsonSchemaProperty> } } };
	};
	return response.schema?.properties?.row?.properties ?? {};
}

export class AccessExl implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AccessEXL',
		name: 'accessExl',
		icon: { light: 'file:../../icons/accessexl.svg', dark: 'file:../../icons/accessexl.dark.svg' },
		group: ['input'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Update inputs, run scenarios and read or write table rows in an Excel workbook through AccessEXL',
		defaults: {
			name: 'AccessEXL',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'accessExlApi',
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
					{ name: 'Workbook', value: 'workbook' },
					{ name: 'Table', value: 'table' },
				],
				default: 'workbook',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['workbook'] } },
				options: [
					{
						name: 'Get Outputs',
						value: 'getOutputs',
						description: "Get the current values of the workbook's readable outputs",
						action: 'Get outputs',
					},
					{
						name: 'Get Schema',
						value: 'getSchema',
						description: "Get the workbook's configured inputs, outputs and tables (counts as one API call)",
						action: 'Get the workbook schema',
					},
					{
						name: 'Refresh Schema',
						value: 'refreshSchema',
						description: "Read the workbook's configuration again (does not use an API call)",
						action: 'Refresh the workbook schema',
					},
					{
						name: 'Run a Scenario',
						value: 'runScenario',
						description: 'Write the inputs, recalculate the workbook and return its outputs in one step',
						action: 'Run a scenario',
					},
					{
						name: 'Update Inputs',
						value: 'updateInputs',
						description: 'Write the inputs and recalculate the workbook',
						action: 'Update inputs',
					},
				],
				default: 'runScenario',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['table'] } },
				options: [
					{
						name: 'Add Row',
						value: 'addRow',
						description: "Write one row using the table's append or overwrite mode",
						action: 'Add a table row',
					},
					{
						name: 'Get Rows',
						value: 'getRows',
						description: 'Get the rows of a readable table, one item per row',
						action: 'Get table rows',
					},
					{
						name: 'Write Multiple Rows',
						value: 'writeRows',
						description:
							"Write one row per input item in a single call, using the table's append or overwrite mode (overwrite replaces the existing rows)",
						action: 'Write multiple table rows',
					},
				],
				default: 'addRow',
			},
			{
				displayName: 'Inputs',
				name: 'inputs',
				type: 'resourceMapper',
				noDataExpression: true,
				required: true,
				default: { mappingMode: 'defineBelow', value: null },
				typeOptions: {
					resourceMapper: {
						resourceMapperMethod: 'getInputFields',
						mode: 'add',
						fieldWords: { singular: 'input', plural: 'inputs' },
						addAllFields: true,
						multiKeyMatch: false,
						supportAutoMap: true,
					},
				},
				displayOptions: { show: { resource: ['workbook'], operation: ['updateInputs', 'runScenario'] } },
			},
			{
				displayName: 'Table Name or ID',
				name: 'tableNameRead',
				type: 'options',
				required: true,
				default: '',
				description:
					'A table the workbook allows reading. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getReadableTables' },
				displayOptions: { show: { resource: ['table'], operation: ['getRows'] } },
			},
			{
				displayName: 'Table Name or ID',
				name: 'tableNameWrite',
				type: 'options',
				required: true,
				default: '',
				description:
					'A table the workbook allows writing to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getWritableTables' },
				displayOptions: { show: { resource: ['table'], operation: ['addRow', 'writeRows'] } },
			},
			{
				displayName: 'Row',
				name: 'row',
				type: 'resourceMapper',
				noDataExpression: true,
				required: true,
				default: { mappingMode: 'defineBelow', value: null },
				typeOptions: {
					loadOptionsDependsOn: ['tableNameWrite'],
					resourceMapper: {
						resourceMapperMethod: 'getTableColumns',
						mode: 'add',
						fieldWords: { singular: 'column', plural: 'columns' },
						addAllFields: true,
						multiKeyMatch: false,
						supportAutoMap: true,
					},
				},
				displayOptions: { show: { resource: ['table'], operation: ['addRow', 'writeRows'] } },
			},
		],
	};

	methods = {
		loadOptions: {
			async getReadableTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await listTables(this, 'readable');
			},
			async getWritableTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await listTables(this, 'writable');
			},
		},
		resourceMapping: {
			async getInputFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				return { fields: fieldsFromProperties(await inputProperties(this)) };
			},
			async getTableColumns(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const tableName = this.getNodeParameter('tableNameWrite', '') as string;
				if (!tableName) return { fields: [] };
				return { fields: fieldsFromProperties(await rowProperties(this, tableName)) };
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		let inputIds: string[] | undefined;
		const knownInputIds = async () => (inputIds ??= Object.keys(await inputProperties(this)));
		const columnIds = new Map<string, string[]>();
		const knownColumnIds = async (tableName: string) => {
			if (!columnIds.has(tableName)) columnIds.set(tableName, Object.keys(await rowProperties(this, tableName)));
			return columnIds.get(tableName) as string[];
		};

		// Several input items become ONE call that writes one row per item.
		if (resource === 'table' && operation === 'writeRows') {
			try {
				const tableName = this.getNodeParameter('tableNameWrite', 0) as string;
				const firstMapper = this.getNodeParameter('row', 0) as MapperParameter;
				const ids = firstMapper.mappingMode === 'autoMapInputData' ? await knownColumnIds(tableName) : [];
				const rows = items.map((item, index) =>
					valuesFromMapper(this.getNodeParameter('row', index) as MapperParameter, item.json, ids),
				);
				const response = await accessExlRequest(this, 'POST', `${tablePath(tableName)}/rows`, { rows: rows as IDataObject[] });
				return [[{ json: response, pairedItem: items.map((_, item) => ({ item })) }]];
			} catch (error) {
				if (this.continueOnFail()) {
					return [[{ json: { error: (error as Error).message }, pairedItem: items.map((_, item) => ({ item })) }]];
				}
				throw new NodeApiError(this.getNode(), error as JsonObject);
			}
		}

		for (let index = 0; index < items.length; index++) {
			try {
				let response: IDataObject;
				if (resource === 'workbook') {
					if (operation === 'getSchema') {
						response = await accessExlRequest(this, 'GET', '/schema');
					} else if (operation === 'refreshSchema') {
						response = await accessExlRequest(this, 'POST', '/schema/refresh');
					} else if (operation === 'getOutputs') {
						response = await accessExlRequest(this, 'GET', '/outputs');
					} else if (operation === 'updateInputs' || operation === 'runScenario') {
						const mapper = this.getNodeParameter('inputs', index) as MapperParameter;
						const values = valuesFromMapper(
							mapper,
							items[index].json,
							mapper.mappingMode === 'autoMapInputData' ? await knownInputIds() : [],
						);
						const path = operation === 'updateInputs' ? '/update-inputs' : '/run-scenario';
						response = await accessExlRequest(this, 'POST', path, { values: values as IDataObject });
					} else {
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
					}
				} else if (operation === 'getRows') {
					const tableName = this.getNodeParameter('tableNameRead', index) as string;
					response = await accessExlRequest(this, 'GET', tablePath(tableName));
					const rows = (response.rows as IDataObject[] | undefined) ?? [];
					for (const row of rows) returnData.push({ json: row, pairedItem: { item: index } });
					continue;
				} else if (operation === 'addRow') {
					const tableName = this.getNodeParameter('tableNameWrite', index) as string;
					const mapper = this.getNodeParameter('row', index) as MapperParameter;
					const row = valuesFromMapper(
						mapper,
						items[index].json,
						mapper.mappingMode === 'autoMapInputData' ? await knownColumnIds(tableName) : [],
					);
					response = await accessExlRequest(this, 'POST', tablePath(tableName), { row: row as IDataObject });
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: index });
				}
				returnData.push({ json: response, pairedItem: { item: index } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: index } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: index });
			}
		}

		return [returnData];
	}
}
