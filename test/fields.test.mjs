import test from 'node:test';
import assert from 'node:assert/strict';

import { fieldsFromProperties, mapperType, valuesFromMapper } from '../dist/nodes/AccessExl/shared/fields.js';

test('schema properties become resource mapper fields with friendly names', () => {
	const fields = fieldsFromProperties({
		Quantity: { type: 'number', title: 'Quantity' },
		Qty: { type: 'integer', title: 'Whole units' },
		Active: { type: 'boolean' },
		Region: { type: 'string', title: 'Sales region', enum: ['North', 'South'] },
		Notes: { type: 'string' },
	});
	assert.deepEqual(
		fields.map((f) => [f.id, f.displayName, f.type]),
		[
			['Quantity', 'Quantity', 'number'],
			['Qty', 'Whole units', 'number'],
			['Active', 'Active', 'boolean'],
			['Region', 'Sales region', 'options'],
			['Notes', 'Notes', 'string'],
		],
	);
	assert.deepEqual(fields[3].options, [
		{ name: 'North', value: 'North' },
		{ name: 'South', value: 'South' },
	]);
	assert.ok(fields.every((f) => f.display && !f.required && !f.canBeUsedToMatch));
	assert.deepEqual(fieldsFromProperties(undefined), []);
	assert.equal(mapperType({ type: 'object' }), 'string');
});

test('manual mapping keeps what was typed and drops empty values', () => {
	const values = valuesFromMapper(
		{ mappingMode: 'defineBelow', value: { Quantity: 5, UnitPrice: 0, Notes: '', Other: null, Flag: false } },
		{},
		['Quantity', 'UnitPrice'],
	);
	assert.deepEqual(values, { Quantity: 5, UnitPrice: 0, Flag: false });
});

test('automatic mapping takes only the input item fields that match the schema', () => {
	const values = valuesFromMapper(
		{ mappingMode: 'autoMapInputData', value: null },
		{ Quantity: 3, UnitPrice: '', Unrelated: 'x' },
		['Quantity', 'UnitPrice'],
	);
	assert.deepEqual(values, { Quantity: 3 });
});

test('no mapper means no values', () => {
	assert.deepEqual(valuesFromMapper(undefined, {}, []), {});
	assert.deepEqual(valuesFromMapper({ mappingMode: 'defineBelow', value: null }, {}, []), {});
});
