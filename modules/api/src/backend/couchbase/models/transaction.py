"""
Model for working with 'transaction' documents in Couchbase.
"""

from typing import Optional
from uuid import UUID
from datetime import date

from couchbase_client import CouchbaseModel


class TransactionModel(CouchbaseModel):
    """
    Model for transaction documents.

    This model inherits from CouchbaseModel which provides:
    - Auto-derived collection name (defaults to "transaction")
    - CRUD operations as class methods: get(), list(), upsert(), delete()
    - Automatic Pydantic validation
    - Collection initialization
    """

    # Document fields - same structure as CostModel
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
