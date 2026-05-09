# @emilfrom/n8n-nodes-actual-budget

This is an n8n community node for working with [Actual Budget](https://actualbudget.org/)
through [actual-http-api](https://github.com/jhonderson/actual-http-api).

[n8n](https://n8n.io/) is a workflow automation platform.

personal project for keeping track of my expenses. Thank you to jhonderson for the actual-http-api and Actual Budget for the software. Thank you Jan Oberhauser for the incredible n8n project.
This was just for fun but let's see how it goes.
I have learned so much about github actions and the npm registry now.

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

## Node version 2 (breaking change)

Version **2** of the **Actual Budget** node removes the old **Import** operation (which used
`POST .../transactions/import` and `imported_id` dedupe). Workflows must use **Transaction: Create**
and amounts as **integer minor units**, matching the [actual-http-api](https://github.com/jhonderson/actual-http-api)
contract (`value * 100` for most currencies).

## Actions

Pick an **Action** on the node:

### Transaction: Create

Creates one transaction per input item using the official single-create endpoint:

`POST /budgets/{budgetSyncId}/accounts/{accountId}/transactions`

Request body matches the API: `learnCategories`, `runTransfers`, and `transaction` with
`account`, `category`, `amount`, `payee_name`, `date`, `cleared` only.

- **Account** / **Category**: selectable lists from `GET /accounts` and `GET /categories`
- **Amount**: integer minor units (for example `-7374` for `-73.74` in a two-decimal currency)
- **Date**: stored as `YYYY-MM-DD`
- **Payee Name**: plain text (for example `Amazon`)
- **Cleared**, **Learn Categories**, **Run Transfers**: booleans

### Budget: Get Month

`GET /budgets/{budgetSyncId}/months/{month}` — pass **Month** as `YYYY-MM`. Output includes the API
`data` payload (totals, category groups, etc.).

### Account: List

`GET /budgets/{budgetSyncId}/accounts` — returns the API response (including `data`).

### Category: List

`GET /budgets/{budgetSyncId}/categories` — returns the API response (including `data`).

## Development

```bash
npm run build
npm run lint
```

## Resources

- [Actual Budget API docs](https://actualbudget.org/docs/api/)
- [actual-http-api](https://github.com/jhonderson/actual-http-api)
- [n8n community node docs](https://docs.n8n.io/integrations/community-nodes/)
