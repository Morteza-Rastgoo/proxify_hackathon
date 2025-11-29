# Refine Transactions - Add Supplier API

This document describes the new API endpoint for adding supplier names to transactions using Gemini AI.

## API Endpoint

**POST** `/costs/refine-transactions-add-supplier`

This endpoint:
1. Fetches all unique `transaction_info` values from the transactions collection
2. Sends them to Gemini 2.0 Flash (via OpenAI-compatible API)
3. Updates all matching transactions with the identified supplier names

## Prerequisites

### 1. Install the openai package

The `openai` package has been added to the API project dependencies.

### 2. Set up OpenRouter API Key

You need an OpenRouter API key to access Gemini models.

#### Getting an OpenRouter API Key:
1. Visit [OpenRouter](https://openrouter.ai/)
2. Sign up or sign in
3. Go to [API Keys](https://openrouter.ai/keys)
4. Create a new API key
5. Copy the generated API key

#### Setting the Environment Variable:

Set the `OPENROUTER_API_KEY` environment variable before running the API:

```bash
export OPENROUTER_API_KEY="your-api-key-here"
```

Or add it to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
echo 'export OPENROUTER_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

## Usage

### 1. Ensure the API is running

The API should be running with the Gemini API key set:

```bash
# Start the API (Polytope should handle this)
cd modules/api
./bin/run
```

### 2. Call the endpoint

```bash
curl -X POST http://localhost:3030/costs/refine-transactions-add-supplier
```

### 3. Response

The endpoint returns:

```json
{
  "message": "Successfully processed 50 unique transaction texts and updated 200 transactions",
  "unique_texts_processed": 50,
  "transactions_updated": 200,
  "supplier_mappings": {
    "SWISH 123456789": "Swish Payment",
    "SPOTIFY AB": "Spotify",
    "ICA MAXI STOCKHOLM": "ICA",
    ...
  }
}
```

## How It Works

1. **Fetch Unique Transaction Texts**: The endpoint queries all unique `transaction_info` values from the transactions collection.

2. **AI Processing**: All unique transaction texts are sent in a single request to Gemini 2.0 Flash with a prompt asking it to identify supplier names.

3. **Update Transactions**: For each transaction text, the identified supplier name is updated in all matching transaction documents using a bulk UPDATE query.

## Error Handling

- If `OPENROUTER_API_KEY` is not set, returns 500 error
- If no transaction texts are found, returns a message with 0 processed
- If the API call fails, returns 500 error with details
- All errors are logged for debugging

## Transaction Model Update

The `TransactionModel` has been updated to include a new optional field:

```python
supplier_name: Optional[str] = None
```

This field will be populated by the AI analysis.

## Model Used

The endpoint uses **Gemini 2.0 Flash Experimental** (`gemini-2.0-flash-exp`), which is:
- Fast and cost-effective
- Supports OpenAI-compatible API
- Good for structured output tasks like this

You can change the model in the code if needed:

```python
model="gemini-2.0-flash-exp"  # Change to other Gemini models as needed
```

## Integration with Workflow

This endpoint is designed to be used after:
1. Uploading costs via `/costs/upload`
2. Refining costs to transactions via `/costs/refine-costs-to-transactions`
3. Then calling this endpoint to add supplier information

## Testing

To test with sample data:

1. Ensure you have transactions in the database
2. Set the OPENROUTER_API_KEY environment variable
3. Call the endpoint
4. Check the transactions to verify supplier_name field is populated

```bash
# Example: Query to see updated transactions
curl http://localhost:3030/costs/
```

## Notes

- The AI model may not always identify suppliers perfectly, especially for ambiguous transaction texts
- Supplier names are normalized by the AI (e.g., "ICA MAXI STOCKHOLM" might become "ICA")
- The endpoint processes all unique transaction texts in a single AI request for efficiency
- If you have many transactions, consider batching or adding pagination in future iterations
