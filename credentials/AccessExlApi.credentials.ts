import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AccessExlApi implements ICredentialType {
	name = 'accessExlApi';

	displayName = 'AccessEXL API';

	icon: Icon = { light: 'file:../icons/accessexl.svg', dark: 'file:../icons/accessexl.dark.svg' };

	documentationUrl = 'https://accessexl.accessanalytic.com.au/help/integration-api-key';

	properties: INodeProperties[] = [
		{
			displayName: 'Workbook API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'The API key for one AccessEXL workbook. Create it in AccessEXL on the Workbooks page (settings icon, API keys). One credential is one workbook.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	// Refreshing the schema never counts against the usage allowance.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.accessanalytic.com.au',
			url: '/schema/refresh',
			method: 'POST',
		},
	};
}
