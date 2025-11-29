# Refine Costs to Transactions API

## Overview
The `refine-costs-to-transactions` endpoint copies cost documents where the account number starts with "4" or higher to a separate transactions collection, avoiding duplicates.

## Endpoint

**POST** `/costs/refine-costs-to-transactions`

## Description
This endpoint:
1. Queries all cost documents where `account_number` starts with '4' or higher (4, 5, 6, 7, 8, 9)
2. Checks if each cost's `vernr` (verification number) already exists in the transactions collection
3. Creates new transaction documents for costs that don't already exist as transactions
4. Skips creating duplicates if a transaction with the same `vernr` already exists

## Usage

```bash
curl -X POST http://localhost:3030/costs/refine-costs-to-transactions \
  -H "Content-Type: application/json"
```

## Response

```json
{
  "message": "Processed 697 costs: created 697 transactions, skipped 0 duplicates",
  "processed": 697,
  "skipped": 0,
  "created": 697
}
```

### Response Fields
- `message`: Human-readable summary of the operation
- `processed`: Total number of costs that matched the criteria (account_number >= 4)
- `skipped`: Number of costs that were skipped because they already existed in transactions
- `created`: Number of new transaction documents created

## Implementation Details

### Models
- **CostModel**: Original cost documents in the `costs` collection
- **TransactionModel**: Transaction documents in the `transactions` collection

Both models share the same schema:
- `vernr`: Verification number (unique identifier used for duplicate detection)
- `account_number`: Account number (filtered by first digit >= '4')
- `posting_date`: Date of posting
- `registration_date`: Date of registration
- `account_name`: Name of the account
- `ks`: Optional field
- `project_number`: Optional project number
- `verification_text`: Optional verification text
- `transaction_info`: Optional transaction information
- `debit`: Debit amount (default: 0.0)
- `credit`: Credit amount (default: 0.0)

### Duplicate Detection
The endpoint uses the `vernr` field to identify duplicates. Each `vernr` should be unique within the transactions collection.

## Testing

First run (creates transactions):
```bash
curl -X POST http://localhost:3030/costs/refine-costs-to-transactions
# Response: {"processed": 697, "created": 697, "skipped": 0}
```

Second run (skips duplicates):
```bash
curl -X POST http://localhost:3030/costs/refine-costs-to-transactions
# Response: {"processed": 697, "created": 0, "skipped": 697}
```

## Error Handling
If an error occurs during processing, the endpoint will return a 500 status code with error details:

```json
{
  "detail": "Error refining costs to transactions: [error message]"
}
