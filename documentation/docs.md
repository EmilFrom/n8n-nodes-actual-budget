# Actual HTTP API Documentation

This documentation provides a comprehensive, structured guide to the **Actual HTTP API** (Version 26.5.0). It is a NodeJS wrapper for the Actual Budget API, exposing its functionality through HTTP endpoints. 

This document is optimized for LLMs to easily understand the context, data models, authentication, and every available endpoint.

---

## 1. Global API Information & Conventions

### Base URL
*   Default: `http://localhost:5007/v1`
*   Configurable: `{protocol}://{host}:{port}/{basePath}` (e.g., `https://localhost:443/v1`)

### Authentication
*   **Type:** API Key
*   **Header Name:** `x-api-key`
*   **Description:** Must be included in the headers of all requests.

### ⚠️ Crucial Data Convention: Currency Amounts
In this API, **all currency amounts are integers** representing the value *without* any decimal places.
*   Formula: `value * 100` (for most currencies).
*   *Example:* A USD amount of `$120.30` must be submitted and will be returned as `12030`. 
*   *Example:* An expense of `-$50.00` is `-5000`.

### Endpoint Annotations
*   **(🔧 Extended)**: Uses official library APIs with additional business logic or transformations.
*   **(⚠️ Unofficial)**: Interacts with the internals of the official library APIs. It is not considered stable or secure for use and may change without notice.

### Shared Common Parameters
Almost all endpoints require the following context variables:
*   `budgetSyncId` *(Path, String, Required)*: The Synchronization ID from Actual Budget → Settings → Show advanced settings → Sync ID.
*   `budget-encryption-password` *(Header, String, Optional)*: Encryption password for end-to-end encrypted budgets. Only needed on the *first* interaction; subsequent requests remember it.

---

## 2. Core Data Models (Schemas)

*Note: For brevity, ID fields are typically UUID strings.*

*   **Account:** `id`, `name`, `offbudget` (boolean), `closed` (boolean).
*   **CategoryGroup:** `id`, `name`, `is_income` (boolean), `hidden` (boolean), `categories` (Array of Category).
*   **Category:** `id`, `name`, `is_income` (boolean), `hidden` (boolean), `group_id` (string).
*   **Payee:** `id`, `name`, `category` (string, optional), `transfer_acct` (string, optional).
*   **Transaction:** `id`, `account`, `date` (YYYY-MM-DD), `amount` (integer), `payee`, `payee_name` (create only), `imported_payee`, `category`, `notes`, `imported_id`, `transfer_id`, `cleared` (boolean/string), `subtransactions` (array).
*   **Tag:** `id`, `tag`, `color`, `description`.
*   **Rule:** `id`, `stage` ("pre", "default", or "post"), `conditionsOp` ("and" or "or"), `conditions` (Array of ConditionOrAction), `actions` (Array of ConditionOrAction).
*   **ConditionOrAction:** `field`, `op`, `value` (string or array of strings), `type`.
*   **Schedule:** `id`, `name`, `rule`, `next_date`, `completed`, `posts_transaction`, `payee`, `account`, `amount`, `amountOp`, `date` (date string or RecurConfig).

---

## 3. Endpoints by Category

### 🏦 Accounts

#### `GET /budgets/{budgetSyncId}/accounts`
*   **Summary:** Returns a list of all accounts.
*   **Response (200):** `{ "data": [ { Account } ] }`

#### `POST /budgets/{budgetSyncId}/accounts`
*   **Summary:** Creates a new account.
*   **Body:** `{ "account": { "name": "String", "offbudget": boolean } }`
*   **Response (200):** `{ "message": "Account created" }`

#### `GET /budgets/{budgetSyncId}/accounts/{accountId}` (🔧 Extended)
*   **Summary:** Returns a specific account's information.
*   **Response (200):** `{ "data": { Account } }`

#### `PATCH /budgets/{budgetSyncId}/accounts/{accountId}`
*   **Summary:** Updates an account.
*   **Body:** `{ "account": { "id": "String", "name": "String", "offbudget": boolean } }`
*   **Response (200):** `{ "message": "Account updated" }`

#### `DELETE /budgets/{budgetSyncId}/accounts/{accountId}`
*   **Summary:** Deletes an account.
*   **Response (200):** `{ "message": "Account deleted" }`

#### `GET /budgets/{budgetSyncId}/accounts/{accountId}/balance`
*   **Summary:** Gets the account balance.
*   **Query Params:** `cutoff_date` (Optional, YYYY-MM-DD). If omitted, uses current date.
*   **Response (200):** `{ "data": 2000 }` *(Integer amount)*

#### `GET /budgets/{budgetSyncId}/accounts/{accountId}/balancehistory` (🔧 Extended)
*   **Summary:** Gets daily balance history for an account.
*   **Query Params:** `since_date` (Required, YYYY-MM-DD), `until_date` (Optional, YYYY-MM-DD, defaults to today).
*   **Response (200):** `{ "data": 2000 }`

#### `PUT /budgets/{budgetSyncId}/accounts/{accountId}/close`
*   **Summary:** Closes an account. 
*   **Body:** If balance > 0, requires a transfer target.
    `{ "transfer": { "transferAccountId": "String", "transferCategoryId": "String" } }`
*   **Response (200):** `{ "message": "Account closed" }`

#### `PUT /budgets/{budgetSyncId}/accounts/{accountId}/reopen`
*   **Summary:** Reopens a closed account.
*   **Response (200):** `{ "message": "Account reopened" }`

#### `POST /budgets/{budgetSyncId}/accounts/{accountId}/banksync`
*   **Summary:** Triggers a bank sync for a specific account.
*   **Response (200):** `{ "message": "Bank sync started" }`

#### `POST /budgets/{budgetSyncId}/accounts/banksync`
*   **Summary:** Triggers a bank sync for ALL linked accounts.
*   **Response (200):** `{ "message": "Bank sync started" }`

---

### 📅 Budget Months

#### `GET /budgets/{budgetSyncId}/months`
*   **Summary:** Returns list of budgeted months.
*   **Response (200):** `{ "data": ["2023-05", "2023-06"] }`

#### `GET /budgets/{budgetSyncId}/months/{month}`
*   **Summary:** Returns budget information for a specific month (Format: `YYYY-MM`).
*   **Response (200):** `{ "data": { BudgetMonth } }` *(Includes totals, income, and category group arrays).*

#### `GET /budgets/{budgetSyncId}/months/{month}/categories` (🔧 Extended)
*   **Summary:** Returns a flat list of categories for the month.
*   **Response (200):** `{ "data": [ { BudgetMonthCategory } ] }`

#### `GET /budgets/{budgetSyncId}/months/{month}/categories/{categoryId}` (🔧 Extended)
*   **Summary:** Returns specific category details for a month.
*   **Response (200):** `{ "data": { BudgetMonthCategory } }`

#### `PATCH /budgets/{budgetSyncId}/months/{month}/categories/{categoryId}` (🔧 Extended)
*   **Summary:** Updates budget allocation for a category in a specific month.
*   **Body:** `{ "category": { "budgeted": integer, "carryover": boolean } }`
*   **Response (200):** `{ "message": "Category updated" }`

#### `GET /budgets/{budgetSyncId}/months/{month}/categorygroups` (🔧 Extended)
*   **Summary:** Returns category groups for the month.
*   **Response (200):** `{ "data": [ { BudgetMonthCategoryGroup } ] }`

#### `GET /budgets/{budgetSyncId}/months/{month}/categorygroups/{categoryGroupId}` (🔧 Extended)
*   **Summary:** Returns a specific category group for the month.
*   **Response (200):** `{ "data": { BudgetMonthCategoryGroup } }`

#### `POST /budgets/{budgetSyncId}/months/{month}/categorytransfers` (🔧 Extended)
*   **Summary:** Moves money between categories for a specific month. If `fromCategoryId` is omitted, money comes from To Be Budgeted.
*   **Body:** `{ "categorytransfer": { "fromCategoryId": "string", "toCategoryId": "string", "amount": integer } }`
*   **Response (200):** `{ "message": "Category transfer created" }`

#### `POST /budgets/{budgetSyncId}/months/{month}/nextmonthbudgethold`
*   **Summary:** Puts an amount on hold for the following month.
*   **Body:** `{ "amount": integer }`
*   **Response (200):** `{ "message": "Budget amount X was put on hold for next month" }`

#### `DELETE /budgets/{budgetSyncId}/months/{month}/nextmonthbudgethold`
*   **Summary:** Resets the budget hold for the month.
*   **Response (200):** `{ "message": "Budget hold reset" }`

---

### 📂 Categories & Category Groups

#### `GET /budgets/{budgetSyncId}/categorygroups`
*   **Summary:** Returns list of category groups.
*   **Response (200):** `{ "data": [ { CategoryGroup } ] }`

#### `POST /budgets/{budgetSyncId}/categorygroups`
*   **Summary:** Creates a category group.
*   **Body:** `{ "category_group": { "name": "String", "is_income": boolean, "hidden": boolean } }`
*   **Response (201):** `{ "data": "UUID" }` *(Returns the new Group ID)*

#### `PATCH /budgets/{budgetSyncId}/categorygroups/{categoryGroupId}`
*   **Summary:** Updates a category group.
*   **Body:** `{ "category_group": { "name": "String", "is_income": boolean, "hidden": boolean } }`
*   **Response (200):** `{ "message": "Category group updated" }`

#### `DELETE /budgets/{budgetSyncId}/categorygroups/{categoryGroupId}`
*   **Summary:** Deletes a category group.
*   **Query Params:** `transfer_category_id` (Optional, string - Destination for existing transactions).
*   **Response (200):** `{ "message": "Category group deleted" }`

#### `GET /budgets/{budgetSyncId}/categories`
*   **Summary:** Returns list of categories.
*   **Response (200):** `{ "data": [ { Category } ] }`

#### `POST /budgets/{budgetSyncId}/categories`
*   **Summary:** Creates a category.
*   **Body:** `{ "category": { "name": "String", "group_id": "String", "is_income": boolean, "hidden": boolean } }`
*   **Response (201):** `{ "data": "UUID" }` *(Returns the new Category ID)*

#### `GET /budgets/{budgetSyncId}/categories/{categoryId}` (🔧 Extended)
*   **Summary:** Returns category information.
*   **Response (200):** `{ "data": { Category } }`

#### `PATCH /budgets/{budgetSyncId}/categories/{categoryId}`
*   **Summary:** Updates a category.
*   **Body:** `{ "category": { "name": "String", "group_id": "String", "is_income": boolean, "hidden": boolean } }`
*   **Response (200):** `{ "message": "Category updated" }`

#### `DELETE /budgets/{budgetSyncId}/categories/{categoryId}`
*   **Summary:** Deletes a category.
*   **Query Params:** `transfer_category_id` (Optional, string - Reassigns existing transactions).
*   **Response (200):** `{ "message": "Category deleted" }`

---

### 📝 Notes

*Notes endpoints use standard `GET`, `PUT` (creates/replaces), and `DELETE` methods.*

#### Categories
*   `GET /budgets/{budgetSyncId}/notes/category/{categoryId}` (🔧 Extended)
*   `PUT /budgets/{budgetSyncId}/notes/category/{categoryId}` (⚠️ Unofficial)
    *   **Body:** `{ "data": "Your note text here" }`
*   `DELETE /budgets/{budgetSyncId}/notes/category/{categoryId}` (⚠️ Unofficial)

#### Accounts
*   `GET /budgets/{budgetSyncId}/notes/account/{accountId}` (🔧 Extended)
*   `PUT /budgets/{budgetSyncId}/notes/account/{accountId}` (⚠️ Unofficial)
    *   **Body:** `{ "data": "Account note text" }`
*   `DELETE /budgets/{budgetSyncId}/notes/account/{accountId}` (⚠️ Unofficial)

#### Budget Months
*   `GET /budgets/{budgetSyncId}/notes/budgetmonth/{budgetMonth}` (🔧 Extended)
*   `PUT /budgets/{budgetSyncId}/notes/budgetmonth/{budgetMonth}` (⚠️ Unofficial)
    *   **Body:** `{ "data": "Month note text" }`
*   `DELETE /budgets/{budgetSyncId}/notes/budgetmonth/{budgetMonth}` (⚠️ Unofficial)

---

### 🏪 Payees

#### `GET /budgets/{budgetSyncId}/payees`
*   **Summary:** Returns list of payees.
*   **Response (200):** `{ "data": [ { Payee } ] }`

#### `POST /budgets/{budgetSyncId}/payees`
*   **Summary:** Creates a payee.
*   **Body:** `{ "payee": { "name": "String" } }`
*   **Response (200):** `{ "data": "UUID" }` *(Returns Payee ID)*

#### `GET /budgets/{budgetSyncId}/payees/{payeeId}`
*   **Summary:** Returns a specific payee.
*   **Response (200):** `{ "data": { Payee } }`

#### `PATCH /budgets/{budgetSyncId}/payees/{payeeId}`
*   **Summary:** Updates a payee.
*   **Body:** `{ "payee": { "name": "String" } }`
*   **Response (200):** `{ "message": "Payee updated" }`

#### `DELETE /budgets/{budgetSyncId}/payees/{payeeId}`
*   **Summary:** Deletes a payee.
*   **Response (200):** `{ "message": "Payee deleted" }`

#### `GET /budgets/{budgetSyncId}/payees/{payeeId}/rules`
*   **Summary:** Returns list of rules associated with a specific payee.
*   **Response (200):** `{ "data": [ { Rule } ] }`

#### `POST /budgets/{budgetSyncId}/payees/merge`
*   **Summary:** Merges multiple payees into a single target payee.
*   **Body:** `{ "targetId": "UUID", "mergeIds": ["UUID1", "UUID2"] }`
*   **Response (200):** `{ "message": "Payees merged" }`

---

### 🚦 Rules

#### `GET /budgets/{budgetSyncId}/rules`
*   **Summary:** Returns list of rules.
*   **Query Params:** `page` (number), `limit` (number).
*   **Response (200):** `{ "data": [ { Rule } ] }`

#### `POST /budgets/{budgetSyncId}/rules`
*   **Summary:** Creates a rule.
*   **Body:** `{ "rule": { "stage": "pre|default|post", "conditionsOp": "and|or", "conditions": [...], "actions": [...] } }`
*   **Response (200):** `{ "data": { Rule } }`

#### `GET /budgets/{budgetSyncId}/rules/{ruleId}`
*   **Summary:** Returns a specific rule.
*   **Response (200):** `{ "data": { Rule } }`

#### `PATCH /budgets/{budgetSyncId}/rules/{ruleId}`
*   **Summary:** Updates a rule.
*   **Body:** `{ "rule": { Rule } }`
*   **Response (200):** `{ "data": { Rule } }`

#### `DELETE /budgets/{budgetSyncId}/rules/{ruleId}`
*   **Summary:** Deletes a rule.
*   **Response (200):** `{ "message": "Rule deleted" }`

---

### 🔍 Query (ActualQL)

#### `POST /budgets/{budgetSyncId}/run-query` (⚠️ Unofficial)
*   **Summary:** Runs an arbitrary ActualQL query on the database.
*   **Body:** 
    ```json
    {
      "ActualQLquery": {
        "table": "transactions",
        "filter": {},
        "select": ["id", "amount"],
        "options": {},
        "limit": 50
      }
    }
    ```
*   **Response (200):** `{ "data": { "object" } }`

---

### 📆 Schedules

#### `GET /budgets/{budgetSyncId}/schedules`
*   **Summary:** Returns list of schedules.
*   **Query Params:** `page` (number), `limit` (number).
*   **Response (200):** `{ "data": [ { Schedule } ] }`

#### `POST /budgets/{budgetSyncId}/schedules`
*   **Summary:** Creates a schedule.
*   **Body:** 
    ```json
    {
      "schedule": {
        "name": "String",
        "posts_transaction": boolean,
        "payee": "UUID",
        "account": "UUID",
        "amount": integer,
        "amountOp": "is|isapprox|isbetween",
        "date": {
          "frequency": "monthly",
          "start": "YYYY-MM-DD",
          "endMode": "never"
        }
      }
    }
    ```
*   **Response (200):** `{ "data": "UUID" }` *(Returns Schedule ID)*

#### `GET /budgets/{budgetSyncId}/schedules/{scheduleId}` (🔧 Extended)
*   **Summary:** Returns a schedule.
*   **Response (200):** `{ "data": { Schedule } }`

#### `PATCH /budgets/{budgetSyncId}/schedules/{scheduleId}`
*   **Summary:** Updates a schedule.
*   **Body:** `{ "schedule": { ScheduleInput } }`
*   **Response (200):** `{ "data": { Schedule } }`

#### `DELETE /budgets/{budgetSyncId}/schedules/{scheduleId}`
*   **Summary:** Deletes a schedule.
*   **Response (200):** `{ "message": "Schedule deleted" }`

---

### ⚙️ Settings / Budgets

#### `GET /budgets`
*   **Summary:** Returns a list of all budget files (local and remote).
*   **Response (200):** `{ "data": [ { Budget } ] }`

#### `GET /actualhttpapiversion`
*   **Summary:** Returns the version of the Actual HTTP API.
*   **Response (200):** `{ "data": { "version": "26.3.0" } }`

#### `GET /budgets/{budgetSyncId}/actualserverversion`
*   **Summary:** Returns the version of the Actual backend server.
*   **Response (200):** `{ "data": { "version": "26.3.0" } }`

#### `GET /budgets/{budgetSyncId}/export` (⚠️ Unofficial)
*   **Summary:** Exports the budget data as a zip file (`db.sqlite` and `metadata.json`).
*   **Response (200):** Zip File Stream.

---

### 🏷️ Tags

#### `GET /budgets/{budgetSyncId}/tags`
*   **Summary:** Returns list of tags.
*   **Response (200):** `{ "data": [ { Tag } ] }`

#### `POST /budgets/{budgetSyncId}/tags`
*   **Summary:** Creates a tag.
*   **Body:** `{ "tag": { "tag": "String", "color": "#Hex", "description": "String" } }`
*   **Response (200):** `{ "data": "UUID" }` *(Returns Tag ID)*

#### `GET /budgets/{budgetSyncId}/tags/{tagId}`
*   **Summary:** Returns a tag.
*   **Response (200):** `{ "data": { Tag } }`

#### `PATCH /budgets/{budgetSyncId}/tags/{tagId}`
*   **Summary:** Updates a tag.
*   **Body:** `{ "tag": { "id": "UUID", "tag": "String", "color": "#Hex" } }`
*   **Response (200):** `{ "message": "Tag updated" }`

#### `DELETE /budgets/{budgetSyncId}/tags/{tagId}`
*   **Summary:** Deletes a tag.
*   **Response (200):** `{ "message": "Tag deleted" }`

---

### 💸 Transactions

#### `GET /budgets/{budgetSyncId}/accounts/{accountId}/transactions`
*   **Summary:** Returns list of transactions for an account.
*   **Query Params:** `since_date` (Required, YYYY-MM-DD), `until_date` (Optional), `page` (Optional), `limit` (Optional).
*   **Response (200):** `{ "data": [ { Transaction } ] }`

#### `POST /budgets/{budgetSyncId}/accounts/{accountId}/transactions`
*   **Summary:** Creates a single transaction.
*   **Body:** 
    ```json
    {
      "learnCategories": boolean,
      "runTransfers": boolean,
      "transaction": {
        "account": "UUID",
        "date": "YYYY-MM-DD",
        "amount": integer,
        "category": "UUID",
        "payee_name": "String",
        "cleared": boolean
      }
    }
    ```
*   **Response (200):** `{ "message": "ok" }`

#### `POST /budgets/{budgetSyncId}/accounts/{accountId}/transactions/batch`
*   **Summary:** Creates a list of transactions at once.
*   **Body:** Same as single create, but replacing `"transaction": {}` with `"transactions": [{...}, {...}]`.
*   **Response (200):** `{ "message": "ok" }`

#### `POST /budgets/{budgetSyncId}/accounts/{accountId}/transactions/import`
*   **Summary:** Imports a list of transactions (ideal for bank syncs/CSV imports).
*   **Body:** 
    ```json
    {
      "transactions": [ { Transaction } ],
      "defaultCleared": true,
      "dryRun": false,
      "reimportDeleted": false
    }
    ```
*   **Response (201):** `{ "data": { "added": ["UUID1"], "updated": ["UUID2"] } }` *(Returns arrays of affected transaction IDs)*

#### `DELETE /budgets/{budgetSyncId}/transactions/batch`
*   **Summary:** Deletes a set of transactions by ID. (Note: Account ID is not in this path).
*   **Body:** `{ "transactionIds": ["UUID1", "UUID2"] }`
*   **Response (200):** `{ "message": "Transactions deleted" }`

#### `PATCH /budgets/{budgetSyncId}/transactions/{transactionId}`
*   **Summary:** Updates a specific transaction.
*   **Body:** `{ "transaction": { "id": "UUID", "account": "UUID", "date": "YYYY-MM-DD", ... } }`
*   **Response (200):** `{ "message": "Transaction updated" }`

#### `DELETE /budgets/{budgetSyncId}/transactions/{transactionId}`
*   **Summary:** Deletes a specific transaction.
*   **Response (200):** `{ "message": "Transaction deleted" }`