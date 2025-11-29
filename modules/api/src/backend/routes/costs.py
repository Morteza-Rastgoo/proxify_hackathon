from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from typing import List, Dict
import uuid
import traceback
import os
import json
from uuid import UUID
from openai import OpenAI
from ..models.cost import Cost
from ..utils.csv_reader import get_costs, parse_csv_content
from ..couchbase.models.cost import CostModel
from ..couchbase.models.transaction import TransactionModel

# Configure logging
import logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/costs",
    tags=["costs"],
)

@router.get("/", response_model=List[Cost])
async def read_costs(request: Request):
    client = request.app.state.couchbase_client
    try:
        # Fetch all costs (adjust limit as needed, default might be 100)
        # For now, let's fetch a reasonable amount to show dashboard populating
        costs = await CostModel.list(client, limit=1000)
        return costs
    except Exception as e:
        print(f"Error fetching from Couchbase: {e}")
        return []

@router.post("/upload")
async def upload_costs(request: Request, file: UploadFile = File(...)):
    try:
        content = await file.read()
        # Ensure we are at the beginning of the file if it was read before
        # await file.seek(0) 
        
        try:
            # Try utf-8-sig first to handle BOM
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                # Try latin-1 or generic fallback if utf-8 fails
                text = content.decode("latin-1")
            
        print(f"Received file content length: {len(text)}")
        
        # Parse CSV
        transactions, parse_errors = parse_csv_content(text)
        print(f"Parsed {len(transactions)} transactions")
        
        if not transactions:
             error_details = "; ".join(parse_errors[:5])
             raise ValueError(f"No valid transactions found in the CSV. Details: {error_details}")

        # Upsert to Couchbase
        client = request.app.state.couchbase_client
        count = 0
        for t in transactions:
            # Map 't' (which is Cost Pydantic model) to CostModel (Couchbase model)
            doc_id = uuid.uuid4()
            
            # Convert Pydantic model to dict
            data = t.dict()
            
            doc = CostModel(
                id=doc_id,
                **data
            )
            
            await CostModel.upsert(client, doc)
            count += 1
            
        return {"message": f"Seeded {count} transactions"}
    except Exception as e:
        print(f"Error processing upload: {e}")
        traceback.print_exc()
        # Provide more detailed error
        raise HTTPException(status_code=500, detail=f"Error processing upload: {str(e)}")


@router.post("/refine-costs-to-transactions")
async def refine_costs_to_transactions(request: Request):
    """
    Refine costs to transactions by copying cost documents where account_number 
    starts with '4' or higher (as string) to the transactions collection.
    Avoids duplicates by checking if vernr already exists in transactions.
    """
    try:
        client = request.app.state.couchbase_client
        
        # Get all costs with account_number starting with 4 or higher
        costs_collection = CostModel._get_collection_name()
        costs_keyspace = client.get_keyspace(costs_collection)
        
        # Query costs where account_number as string starts with 4, 5, 6, 7, 8, or 9
        query = f"""
            SELECT META().id as id, {costs_collection}.*
            FROM `{costs_keyspace.bucket_name}`.`{costs_keyspace.scope_name}`.`{costs_keyspace.collection_name}`
            WHERE SUBSTR(TO_STRING(account_number), 0, 1) >= '4'
        """
        
        costs_to_process = await client.query_documents(query)
        logger.info(f"Found {len(costs_to_process)} costs with account_number starting with 4 or higher")
        
        if not costs_to_process:
            return {
                "message": "No costs found with account_number starting with 4 or higher",
                "processed": 0,
                "skipped": 0,
                "created": 0
            }
        
        # Get all existing transactions to check for duplicates
        transactions_collection = TransactionModel._get_collection_name()
        transactions_keyspace = client.get_keyspace(transactions_collection)
        
        # Get all existing vernr values from transactions
        existing_query = f"""
            SELECT vernr
            FROM `{transactions_keyspace.bucket_name}`.`{transactions_keyspace.scope_name}`.`{transactions_keyspace.collection_name}`
        """
        
        existing_transactions = await client.query_documents(existing_query)
        existing_vernrs = {t['vernr'] for t in existing_transactions}
        logger.info(f"Found {len(existing_vernrs)} existing transactions")
        
        # Process each cost and create transactions for new ones
        created_count = 0
        skipped_count = 0
        
        for cost_data in costs_to_process:
            # Check if this vernr already exists in transactions
            if cost_data['vernr'] in existing_vernrs:
                skipped_count += 1
                logger.debug(f"Skipping duplicate transaction with vernr: {cost_data['vernr']}")
                continue
            
            # Create new transaction from cost data
            transaction_id = uuid.uuid4()
            
            # Remove the 'id' field from cost_data since we're creating a new transaction with new ID
            cost_data_copy = cost_data.copy()
            if 'id' in cost_data_copy:
                del cost_data_copy['id']
            
            transaction = TransactionModel(
                id=transaction_id,
                **cost_data_copy
            )
            
            await TransactionModel.upsert(client, transaction)
            created_count += 1
            logger.debug(f"Created transaction with vernr: {cost_data['vernr']}")
        
        return {
            "message": f"Processed {len(costs_to_process)} costs: created {created_count} transactions, skipped {skipped_count} duplicates",
            "processed": len(costs_to_process),
            "skipped": skipped_count,
            "created": created_count
        }
        
    except Exception as e:
        logger.error(f"Error in refine_costs_to_transactions: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Error refining costs to transactions: {str(e)}"
        )


@router.post("/refine-transactions-add-supplier")
async def refine_transactions_add_supplier(request: Request):
    """
    Refine transactions by adding supplier names using Gemini AI.
    Fetches all unique verification_texts, sends them to Gemini 3 Pro Preview,
    and updates all matching transactions with the supplier_name.
    """
    try:
        client = request.app.state.couchbase_client
        
        # Get API key from environment
        openrouter_api_key = os.environ.get("AI_API_KEY")
        if not openrouter_api_key:
            raise HTTPException(
                status_code=500,
                detail="AI_API_KEY environment variable is not set"
            )
        
        # Get all transactions to find unique verification_texts
        transactions_collection = TransactionModel._get_collection_name()
        transactions_keyspace = client.get_keyspace(transactions_collection)
        
        # Query to get all unique transaction_info values (non-null)
        query = f"""
            SELECT DISTINCT verification_text
            FROM `{transactions_keyspace.bucket_name}`.`{transactions_keyspace.scope_name}`.`{transactions_keyspace.collection_name}`
            WHERE verification_text IS NOT NULL AND verification_text != ''
        """
        
        result = await client.query_documents(query)
        unique_verification_texts = [item['verification_text'] for item in result]
        
        logger.info(f"Found {len(unique_verification_texts)} unique transaction texts")
        
        if not unique_verification_texts:
            return {
                "message": "No verification texts found to process",
                "processed": 0,
                "updated": 0
            }
        
        # Initialize OpenAI client for OpenRouter
        openai_client = OpenAI(
            api_key=openrouter_api_key,
            base_url="https://openrouter.ai/api/v1"
        )
        
        # Prepare prompt for Gemini
        verification_text_list = "\n".join([f"{i+1}. {text}" for i, text in enumerate(unique_verification_texts)])
        
        prompt = f"""You are a financial transaction analyzer. Given a list of transaction texts, identify the supplier/vendor name for each transaction.

For each transaction text below, extract and return ONLY the supplier/vendor name. If you can't identify a clear supplier, return "Unknown".

Return the results as a JSON array where each element is an object with:
- "verification_text": the original transaction text
- "supplier_name": the identified supplier name

Transaction texts:
{verification_text_list}

Return ONLY valid JSON, no additional text or explanation."""
        
        logger.info("Sending request to Gemini API...")
        
        # Call Gemini API
        try:
            response = openai_client.chat.completions.create(
                model="google/gemini-3-pro-preview",
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            ai_response = response.choices[0].message.content
            logger.info(f"Received response from Gemini API")
            
            # Parse the JSON response
            # Remove markdown code blocks if present
            if ai_response.startswith("```"):
                # Extract content between ```json and ```
                start = ai_response.find("```json")
                if start != -1:
                    start += 7
                else:
                    start = ai_response.find("```") + 3
                end = ai_response.rfind("```")
                ai_response = ai_response[start:end].strip()
            
            supplier_mappings = json.loads(ai_response)
            
            # Create a mapping dictionary
            text_to_supplier = {
                item['verification_text']: item['supplier_name'] 
                for item in supplier_mappings
            }
            
            logger.info(f"Parsed {len(text_to_supplier)} supplier mappings")
            
        except Exception as e:
            logger.error(f"Error calling Gemini API: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error calling Gemini API: {str(e)}"
            )
        
        # Update all transactions with supplier names
        updated_count = 0
        
        for verification_text, supplier_name in text_to_supplier.items():
            # Query to find all transactions with this transaction_info
            update_query = f"""
                UPDATE `{transactions_keyspace.bucket_name}`.`{transactions_keyspace.scope_name}`.`{transactions_keyspace.collection_name}`
                SET supplier_name = $supplier_name
                WHERE transaction_info = $verification_text
                RETURNING META().id
            """
            
            updated = await client.query_documents(
                update_query,
                supplier_name=supplier_name,
                verification_text=verification_text
            )
            
            updated_count += len(updated)
            logger.debug(f"Updated {len(updated)} transactions with supplier: {supplier_name}")
        
        return {
            "message": f"Successfully processed {len(unique_verification_texts)} unique transaction texts and updated {updated_count} transactions",
            "unique_texts_processed": len(unique_verification_texts),
            "transactions_updated": updated_count,
            "supplier_mappings": text_to_supplier
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in refine_transactions_add_supplier: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error refining transactions with supplier names: {str(e)}"
        )
