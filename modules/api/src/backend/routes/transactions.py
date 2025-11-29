from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
import traceback

# Import models
from ..couchbase.models.transaction import TransactionModel

# Configure logging
import logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
)

class TransactionDTO(BaseModel):
    id: str
    vernr: str
    account_number: int
    posting_date: date
    registration_date: date
    account_name: str
    ks: Optional[str] = None
    project_number: Optional[str] = None
    verification_text: Optional[str] = None
    transaction_info: Optional[str] = None
    debit: float = 0.0
    credit: float = 0.0
    supplier_name: Optional[str] = None

class PaginatedTransactions(BaseModel):
    items: List[TransactionDTO]
    total: int

@router.get("/", response_model=PaginatedTransactions)
async def read_transactions(
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
        "credit",
        "supplier_name"
    ]
    if sort_by not in allowed_sort_fields:
        sort_by = "posting_date"
        
    # Validate order
    if order.lower() not in ["asc", "desc"]:
        order = "desc"

    order_clause = f"{sort_by} {order.upper()}"

    try:
        total = await TransactionModel.count(client)
        transactions = await TransactionModel.list(client, limit=limit, offset=offset, order_by=order_clause)
        return {"items": transactions, "total": total}
    except Exception as e:
        print(f"Error fetching transactions from Couchbase: {e}")
        traceback.print_exc()
        return {"items": [], "total": 0}
