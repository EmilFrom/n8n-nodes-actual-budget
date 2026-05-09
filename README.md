# @emilfrom/n8n-nodes-actual-budget

This is an n8n community node for importing income and expenses into
[Actual Budget](https://actualbudget.org/) through
[actual-http-api](https://github.com/jhonderson/actual-http-api).

[n8n](https://n8n.io/) is a workflow automation platform.

## Installation

Follow the n8n community node
[installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

For local development in this repository:

```bash
npm install
npm run dev
```

## Prerequisites

Run `actual-http-api` somewhere n8n can reach it. The API service needs access to
your Actual server and should be configured with an `API_KEY`,
`ACTUAL_SERVER_URL`, and `ACTUAL_SERVER_PASSWORD`.

Example:

```bash
docker run -d --name actualhttpapi \
  -v "$PWD/data:/data:rw" \
  -p 5007:5007 \
  -e ACTUAL_SERVER_URL="http://actual-server:5006/" \
  -e ACTUAL_SERVER_PASSWORD="your-actual-password" \
  -e API_KEY="your-api-key" \
  jhonderson/actual-http-api:26.5.0
```

## Credentials

Create an `Actual HTTP API` credential in n8n with:

- `Base URL`: The actual-http-api base URL, for example `http://localhost:5007`
- `API Key`: The `API_KEY` configured for actual-http-api
- `Budget Sync ID`: The Sync ID from Actual Budget settings under advanced settings
- `Budget Encryption Password`: Optional, only for encrypted budgets

The credential test calls `GET /budgets/{budgetSyncId}/accounts`.

## Operations

### Transaction: Import Expense/Income

Imports one transaction per incoming n8n item using Actual's transaction import
endpoint. This operation is idempotent when the same transaction UUID is reused,
because the UUID is sent as `imported_id`.

Required fields:

- `Account`: Actual account ID, selectable from actual-http-api
- `Transaction Type`: `Expense` or `Income`
- `Amount`: Positive decimal amount, for example `12.34`
- `Date`: Transaction date or date-time. Actual stores the date only.
- `Transaction UUID`: Stable unique identifier for dedupe/upsert behavior
- `Payee`: Existing payee from the dropdown or a payee name
- `Category`: Actual category ID, selectable from actual-http-api

Optional fields:

- `Notes`
- `Cleared`
- `Default Cleared`
- `Dry Run`
- `Reimport Deleted`

## Amounts

Enter positive decimal amounts. The node converts them to Actual's integer amount
format:

- Expense `12.34` becomes `-1234`
- Income `12.34` becomes `1234`

## Development

```bash
npm run build
npm run lint
```

## Resources

- [Actual Budget API docs](https://actualbudget.org/docs/api/)
- [actual-http-api](https://github.com/jhonderson/actual-http-api)
- [n8n community node docs](https://docs.n8n.io/integrations/community-nodes/)
