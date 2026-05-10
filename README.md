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

- `Base URL`: Host (and optional path) where actual-http-api listens — for example `http://localhost:5007`, `http://actualhttpapi:5007`, or `http://localhost:5007/v1`. **Host-only URLs** (no path) automatically use the API root **`/v1`**, matching [actual-http-api OpenAPI](https://github.com/jhonderson/actual-http-api) defaults.
- `API Key`: The `API_KEY` configured for actual-http-api
- `Budget Sync ID`: The Sync ID from Actual Budget settings under advanced settings
- `Budget Encryption Password`: Optional, only for encrypted budgets

The credential test calls `GET /v1/budgets/{budgetSyncId}/accounts` (or the same path under your custom base URL).

### Troubleshooting

| Symptom | What to check |
|--------|----------------|
| **404** on `/budgets/...` | **Budget Sync ID** must match the budget file on the Actual server that actual-http-api uses. Confirm with curl against the same host (routes live under **`/v1/budgets/...`**). |
| **`ECONNREFUSED` to `::1` or `127.0.0.1`** | n8n runs in Docker: **`localhost` inside the container is not your host.** Use the container/service DNS name (e.g. `http://actualhttpapi:5007`) or the LAN IP n8n can reach. |
| Works in curl but not in n8n | Same **Base URL** shape as curl (host/service name), same sync id and API key. See [Debugging (logs)](#debugging-logs). |

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

### Category: Create

`POST /budgets/{budgetSyncId}/categories` with body `{ category: { name, group_id, is_income, hidden } }`. Pick a **category group** from the searchable list (same groups as in Actual). Response includes `data` (new category id); the node also exposes **`categoryId`** on the output item for convenience.

### Transaction: Create — category UX

Under **Transaction: Create**, **Category** controls how the category is chosen:

- **Existing Category** — same as before: pick a category (list or UUID).
- **Create New Category** — the node calls **POST /categories** with your name and group, reads the new id from the API response, then creates the transaction with that category. The execution output includes **`categoryCreate`** (request/response and resolved id) next to the transaction **`request`** / API response.

## Debugging (logs)

This node uses n8n’s **`LoggerProxy`** from `n8n-workflow` (same approach as [n8n’s logging docs](https://docs.n8n.io/hosting/logging-monitoring/logging/)): each outbound call logs at **info** (method, resource, URL with the sync id redacted as `_syncId_`), extra hints at **debug**, and **warn** if the request fails (HTTP status when present; **404** entries may include a short `troubleshootingHint`). You do **not** need to add `/v1` manually when using a host-only Base URL — it is applied automatically.

**Where to read logs:** server stdout/stderr (Docker/Kubernetes logs) or the log file if you enable file output — not the workflow execution panel in the editor.

**Environment variables** (optional; defaults are usually enough until you need more detail):

| Variable | Typical value | Purpose |
|----------|-----------------|--------|
| `N8N_LOG_LEVEL` | `info` (default) | Use **`debug`** to include `Logger.debug` lines (credential-shape hints). |
| `N8N_LOG_OUTPUT` | `console` (default) | Use `console,file` and set `N8N_LOG_FILE_LOCATION` if you want a persistent log file. |
| `N8N_LOG_FILE_LOCATION` | e.g. `/home/node/.n8n/logs/n8n.log` | Path when `N8N_LOG_OUTPUT` includes `file`. |

After changing env vars, restart n8n.

## Development

```bash
npm run build
npm run lint
```

## Resources

- [Actual Budget API docs](https://actualbudget.org/docs/api/)
- [actual-http-api](https://github.com/jhonderson/actual-http-api)
- [n8n community node docs](https://docs.n8n.io/integrations/community-nodes/)
