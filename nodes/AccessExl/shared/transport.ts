import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

export const BASE_URL = 'https://api.accessanalytic.com.au';

// One request to the AccessEXL API with the workbook key from the credential. n8n turns an HTTP error into a node error that
// shows the API's own message (for example "Invalid API key" or "'Quantity' above maximum 1000").
export async function accessExlRequest(
	context: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const response = await context.helpers.httpRequestWithAuthentication.call(context, 'accessExlApi', {
		method,
		url: `${BASE_URL}${path}`,
		body,
		qs,
		json: true,
	});
	return response as IDataObject;
}

export function tablePath(tableName: string): string {
	return `/blocks/${encodeURIComponent(tableName)}`;
}
