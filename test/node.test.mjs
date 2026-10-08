import test from 'node:test';
import assert from 'node:assert/strict';

import { AccessExl } from '../dist/nodes/AccessExl/AccessExl.node.js';

// A fake n8n execution context: records every API call and answers from a table of canned responses.
function context({ params, items = [{ json: {} }], responses = {}, continueOnFail = false }) {
	const calls = [];
	return {
		calls,
		getInputData: () => items,
		getNodeParameter: (name, index) => {
			const value = params[name];
			return typeof value === 'function' ? value(index) : value;
		},
		continueOnFail: () => continueOnFail,
		getNode: () => ({ name: 'AccessEXL', type: 'n8n-nodes-accessexl.accessExl', typeVersion: 1, id: 'x', position: [0, 0], parameters: {} }),
		helpers: {
			httpRequestWithAuthentication: async (credential, options) => {
				calls.push({ credential, method: options.method, url: options.url, body: options.body, qs: options.qs });
				const key = `${options.method} ${options.url.replace('https://api.accessanalytic.com.au', '')}`;
				const answer = responses[key];
				if (answer instanceof Error) throw answer;
				return answer ?? {};
			},
		},
	};
}

const node = new AccessExl();
const run = (ctx) => node.execute.call(ctx);

const INPUT_SCHEMA = { schema: { properties: { Quantity: { type: 'number', title: 'Quantity' }, UnitPrice: { type: 'number', title: 'Unit price' } } } };

test('Run a Scenario sends the mapped inputs as values and returns the response', async () => {
	const ctx = context({
		params: {
			resource: 'workbook',
			operation: 'runScenario',
			inputs: { mappingMode: 'defineBelow', value: { Quantity: 4, UnitPrice: 25, Unset: '' } },
		},
		responses: { 'POST /run-scenario': { status: 'updated', outputs: { Total: 100 } } },
	});
	const [out] = await run(ctx);
	assert.deepEqual(ctx.calls[0], {
		credential: 'accessExlApi',
		method: 'POST',
		url: 'https://api.accessanalytic.com.au/run-scenario',
		body: { values: { Quantity: 4, UnitPrice: 25 } },
		qs: undefined,
	});
	assert.equal(out[0].json.outputs.Total, 100);
});

test('Update Inputs with automatic mapping uses the matching fields of each input item', async () => {
	const ctx = context({
		items: [{ json: { Quantity: 1, Junk: 'x' } }, { json: { Quantity: 2, UnitPrice: 9 } }],
		params: { resource: 'workbook', operation: 'updateInputs', inputs: { mappingMode: 'autoMapInputData', value: null } },
		responses: { 'GET /schema/input-schema': INPUT_SCHEMA, 'POST /update-inputs': { status: 'updated' } },
	});
	const [out] = await run(ctx);
	const posts = ctx.calls.filter((c) => c.method === 'POST');
	assert.deepEqual(posts.map((c) => c.body), [{ values: { Quantity: 1 } }, { values: { Quantity: 2, UnitPrice: 9 } }]);
	assert.equal(ctx.calls.filter((c) => c.url.endsWith('/input-schema')).length, 1, 'schema fetched once');
	assert.equal(out.length, 2);
});

test('Get Rows returns one item per row', async () => {
	const ctx = context({
		params: { resource: 'table', operation: 'getRows', tableNameRead: 'Review Rows' },
		responses: { 'GET /blocks/Review%20Rows': { rows: [{ Item: 'A' }, { Item: 'B' }] } },
	});
	const [out] = await run(ctx);
	assert.deepEqual(out.map((i) => i.json), [{ Item: 'A' }, { Item: 'B' }]);
});

test('Add Row sends a single row to the table path', async () => {
	const ctx = context({
		params: {
			resource: 'table',
			operation: 'addRow',
			tableNameWrite: 'ReviewRows',
			row: { mappingMode: 'defineBelow', value: { Item: 'x', Units: 2 } },
		},
		responses: { 'POST /blocks/ReviewRows': { status: 'updated', rows_written: 1 } },
	});
	const [out] = await run(ctx);
	assert.deepEqual(ctx.calls[0].body, { row: { Item: 'x', Units: 2 } });
	assert.equal(out[0].json.rows_written, 1);
});

test('Write Multiple Rows makes ONE call with a row per input item', async () => {
	const ctx = context({
		items: [{ json: { Item: 'a', Units: 1 } }, { json: { Item: 'b', Units: 2 } }, { json: { Item: 'c', Units: 3 } }],
		params: { resource: 'table', operation: 'writeRows', tableNameWrite: 'ReviewRows', row: { mappingMode: 'autoMapInputData', value: null } },
		responses: {
			'GET /schema/tables/ReviewRows/row-schema': { schema: { properties: { row: { properties: { Item: { type: 'string' }, Units: { type: 'number' } } } } } },
			'POST /blocks/ReviewRows/rows': { status: 'updated', rows_written: 3 },
		},
	});
	const [out] = await run(ctx);
	const writes = ctx.calls.filter((c) => c.method === 'POST');
	assert.equal(writes.length, 1);
	assert.deepEqual(writes[0].body, { rows: [{ Item: 'a', Units: 1 }, { Item: 'b', Units: 2 }, { Item: 'c', Units: 3 }] });
	assert.equal(out.length, 1);
	assert.equal(out[0].json.rows_written, 3);
});

test('an API error stops the node, or becomes an error item with Continue On Fail', async () => {
	const failing = { 'GET /outputs': new Error('Invalid API key') };
	await assert.rejects(() => run(context({ params: { resource: 'workbook', operation: 'getOutputs' }, responses: failing })));
	const [out] = await run(context({ params: { resource: 'workbook', operation: 'getOutputs' }, responses: failing, continueOnFail: true }));
	assert.equal(out[0].json.error, 'Invalid API key');
});

test('the dropdown and field loaders read the helper endpoints', async () => {
	const loaders = node.methods;
	const calls = [];
	const loadCtx = (answers, params = {}) => ({
		getNodeParameter: (name, fallback) => params[name] ?? fallback,
		helpers: { httpRequestWithAuthentication: async (_c, o) => { calls.push(o.url); return answers[o.url.replace('https://api.accessanalytic.com.au', '')] ?? {}; } },
	});
	const tables = await loaders.loadOptions.getWritableTables.call(loadCtx({ '/schema/tables/writable': { tables: [{ name: 'ReviewRows' }, { name: 'ReviewWriteOnly' }] } }));
	assert.deepEqual(tables, [{ name: 'ReviewRows', value: 'ReviewRows' }, { name: 'ReviewWriteOnly', value: 'ReviewWriteOnly' }]);
	const inputs = await loaders.resourceMapping.getInputFields.call(loadCtx({ '/schema/input-schema': INPUT_SCHEMA }));
	assert.deepEqual(inputs.fields.map((f) => [f.id, f.displayName]), [['Quantity', 'Quantity'], ['UnitPrice', 'Unit price']]);
	assert.deepEqual((await loaders.resourceMapping.getTableColumns.call(loadCtx({}, {}))).fields, []);
});
