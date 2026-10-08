# n8n-nodes-accessexl

This is an n8n community node for [AccessEXL](https://accessexl.accessanalytic.com.au). AccessEXL connects Excel workbooks stored in SharePoint to your automations through a controlled API. The workbook owner decides which named input cells, output cells and tables are available, and your workflows can then update inputs, recalculate the workbook, read results and read or write table rows, without anyone sharing the file itself.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Example workflows](#example-workflows) · [Limitations](#known-issues-and-limitations) · [Resources](#resources)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n documentation and install the package `n8n-nodes-accessexl`.

## Credentials

You need an AccessEXL account and a workbook that has been connected in AccessEXL.

1. Sign in to AccessEXL and open the Workbooks page.
2. Open the settings (gear) icon of your workbook.
3. Under API keys, enter a label such as `n8n` and choose Add a new key. Copy the key straight away: it is shown only once.
4. In n8n, create an **AccessEXL API** credential and paste the key into **Workbook API Key**.

One credential is one workbook. For another workbook, create another credential with that workbook's own key. The credential test uses an endpoint that never counts against your usage allowance.

## Operations

The inputs, outputs and table columns shown in the node come from your workbook's own configuration, so they differ between credentials.

### Workbook

- **Run a Scenario:** write the inputs, recalculate the workbook and return its outputs in one step. This is the recommended way to calculate.
- **Update Inputs:** write the inputs and recalculate the workbook.
- **Get Outputs:** get the current values of the workbook's readable outputs.
- **Get Schema:** get the configured inputs, outputs, tables, display names and descriptions. This counts as one API call.
- **Refresh Schema:** read the workbook's configuration again. This does not use an API call.

### Table

- **Get Rows:** return the rows of a readable table, one n8n item per row.
- **Add Row:** write one row using the table's append or overwrite mode.
- **Write Multiple Rows:** write one row per input item in a single call. Overwrite tables have their existing rows replaced. Entirely blank rows are skipped.

For the inputs and row columns you can map values manually or choose **Map Automatically** to take the fields of the incoming item that have matching names. Empty values mean "not set".

## Example workflows

- **Scenario on a schedule:** Schedule Trigger, then **AccessEXL: Run a Scenario** with your assumptions, then send the returned outputs by email.
- **Log results to a table:** any trigger, then **AccessEXL: Add Row** to write each result into a workbook table.
- **Read, then calculate:** **AccessEXL: Get Rows**, then **Run a Scenario** with values taken from each row.

## Known issues and limitations

- Reading the workbook's setup while you build a workflow does not count as usage. Get Schema, Run a Scenario, Update Inputs, Get Outputs, Get Rows, Add Row and Write Multiple Rows do count towards your organisation's AccessEXL allowance.
- A new Excel table contains one empty row, so Get Rows can return an empty first row until real data has been written.
- Limits set in the workbook's configuration (for example a minimum or maximum) are checked by AccessEXL, and an out-of-range value returns a clear error.
- Reading a write-only table is refused by design.

## Resources

- [AccessEXL Quick start](https://accessexl.accessanalytic.com.au/quickstart)
- [How to find your workbook API key](https://accessexl.accessanalytic.com.au/help/integration-api-key)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Version history

See [CHANGELOG.md](CHANGELOG.md).

## Licence

[MIT](LICENSE.md)
