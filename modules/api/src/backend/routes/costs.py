from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from typing import List
import uuid
import traceback
from uuid import UUID
from ..models.cost import Cost
from ..utils.csv_reader import get_costs, parse_csv_content
from ..couchbase.models.cost import CostModel

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
