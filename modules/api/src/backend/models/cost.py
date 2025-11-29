from pydantic import BaseModel
from typing import Optional
from datetime import date

class Cost(BaseModel):
    vernr: str
    account_number: int
    posting_date: date
    registration_date: date
    account_name: str
    ks: Optional[str] = None
    project_number: Optional[str] = None
    verification_text: Optional[str] = None
    transaction_info: Optional[str] = None
    debit: float
    credit: float
    supplier_name: Optional[str]
