// Pure helpers: turn the JSON Schema the AccessEXL API returns for a workbook's inputs and a table's columns into n8n
// resource mapper fields, and read the values a user entered back out of a resource mapper parameter.

export interface JsonSchemaProperty {
	type?: string;
	title?: string;
	description?: string;
	enum?: Array<string | number | boolean>;
}

export interface MapperField {
	id: string;
	displayName: string;
	required: boolean;
	defaultMatch: boolean;
	canBeUsedToMatch: boolean;
	display: boolean;
	type: 'string' | 'number' | 'boolean' | 'options';
	options?: Array<{ name: string; value: string | number | boolean }>;
}

export function mapperType(property: JsonSchemaProperty): MapperField['type'] {
	if (Array.isArray(property.enum) && property.enum.length > 0) return 'options';
	if (property.type === 'number' || property.type === 'integer') return 'number';
	if (property.type === 'boolean') return 'boolean';
	return 'string';
}

export function fieldsFromProperties(properties: Record<string, JsonSchemaProperty> | undefined): MapperField[] {
	return Object.entries(properties ?? {}).map(([id, property]) => {
		const field: MapperField = {
			id,
			displayName: property.title || id,
			required: false,
			defaultMatch: false,
			canBeUsedToMatch: false,
			display: true,
			type: mapperType(property),
		};
		if (field.type === 'options') {
			field.options = (property.enum ?? []).map((value) => ({ name: String(value), value }));
		}
		return field;
	});
}

export interface MapperParameter {
	mappingMode?: string;
	value?: Record<string, unknown> | null;
}

function isBlank(value: unknown): boolean {
	return value === null || value === undefined || value === '';
}

// Values for one input item. "Map automatically" takes the item's own fields whose names match the schema; "Map manually" takes
// what the user typed. Empty values mean "not set" and are left out, as in the Make, Zapier and Power Automate integrations.
export function valuesFromMapper(
	mapper: MapperParameter | undefined,
	itemJson: Record<string, unknown>,
	fieldIds: string[],
): Record<string, unknown> {
	const source =
		mapper?.mappingMode === 'autoMapInputData'
			? Object.fromEntries(fieldIds.filter((id) => id in itemJson).map((id) => [id, itemJson[id]]))
			: (mapper?.value ?? {});
	return Object.fromEntries(Object.entries(source).filter(([, value]) => !isBlank(value)));
}
