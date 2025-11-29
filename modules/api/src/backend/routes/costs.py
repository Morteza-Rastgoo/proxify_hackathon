from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from typing import List, Optional
import uuid
import traceback
from uuid import UUID
from pydantic import BaseModel
from ..models.costs import Cost
from ..utils.csv_reader import get_costs, parse_csv_content
from ..couchbase.models.costs import CostModel

# Configure logging
import logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/costs",
    tags=["costs"],
)

class PaginatedCosts(BaseModel):
    items: List[Cost]
    total: int

@router.get("/", response_model=PaginatedCosts)
async def read_costs(
    request: Request,
    sort_by: str = "posting_date",
    order: str = "desc",
    limit: int = 20,
    offset: int = 0
):
    client = request.app.state.couchbase_client
    
    # Validate sort_by to prevent N1QL injection
    allowed_sort_fields = [
        "posting_date", 
        "account_number", 
        "account_name", 
        "verification_text", 
        "debit",
        "credit"
    ]
    if sort_by not in allowed_sort_fields:
        sort_by = "posting_date"
        
    # Validate order
    if order.lower() not in ["asc", "desc"]:
        order = "desc"

    order_clause = f"{sort_by} {order.upper()}"

    try:
        total = await CostModel.count(client)
        costs = await CostModel.list(client, limit=limit, offset=offset, order_by=order_clause)
        return {"items": costs, "total": total}
    except Exception as e:
        print(f"Error fetching from Couchbase: {e}")
        return {"items": [], "total": 0}

@router.post("/upload")
async def upload_costs(
    request: Request, 
    file: UploadFile = File(...),
    duplicate_strategy: str = Form("keep")
):
    client = request.app.state.couchbase_client
    
    try:
        content = await file.read()
        
        try:
            # Try utf-8-sig first to handle BOM
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                # Try latin-1 or generic fallback if utf-8 fails
                text = content.decode("latin-1")
            
        print(f"Received file content length: {len(text)} with duplicate strategy: {duplicate_strategy}")
        
        # Parse CSV
        transactions, parse_errors = parse_csv_content(text)
        print(f"Parsed {len(transactions)} transactions")
        
        if not transactions:
             error_details = "; ".join(parse_errors[:5])
             raise ValueError(f"No valid transactions found in the CSV. Details: {error_details}")

        # For skip/replace strategies, we need to fetch existing transactions to check for duplicates
        # This is a naive implementation. For large datasets, this should be optimized (e.g. batch checks or N1QL)
        existing_vernr = {}
        if duplicate_strategy in ["skip", "replace"]:
            # Fetch all costs to check against vernr. 
            # Ideally we would query for just the Vernrs we are uploading, but for now fetching all is simpler for this hackathon scope
            # Or even better: CostModel should have vernr as a secondary index or part of the key
            existing_costs = await CostModel.list(client, limit=10000) # Adjust limit as needed
            # Assuming vernr is present in CostModel
            existing_vernr = {c.vernr: c.id for c in existing_costs if hasattr(c, 'vernr')}

        count = 0
        skipped = 0
        replaced = 0

        for t in transactions:
            # Check for duplicates based on vernr
            existing_id = existing_vernr.get(t.vernr)
            
            if existing_id and duplicate_strategy == "skip":
                skipped += 1
                continue
            
            if existing_id and duplicate_strategy == "replace":
                # We reuse the existing ID to "replace" the document (upserting with same ID)
                doc_id = existing_id
                replaced += 1
            else:
                # New document
                doc_id = uuid.uuid4()

            # Convert Pydantic model to dict
            # Use model_dump if available (Pydantic v2), fallback to dict (v1)
            if hasattr(t, "model_dump"):
                data = t.model_dump()
            else:
                data = t.dict()
            
            doc = CostModel(
                id=doc_id,
                **data
            )
            
            await CostModel.upsert(client, doc)
            count += 1

        message = f"Processed {len(transactions)} transactions."
        if duplicate_strategy == "skip":
            message += f" Skipped {skipped} duplicates. Imported {count} new."
        elif duplicate_strategy == "replace":
            message += f" Replaced {replaced} existing. Imported/Updated {count} total."
        else:
            message += f" Imported {count} transactions."
            
        return {"message": message}
    except Exception as e:
        print(f"Error processing upload: {e}")
        traceback.print_exc()
        # Provide more detailed error
        raise HTTPException(status_code=500, detail=f"Error processing upload: {str(e)}")
