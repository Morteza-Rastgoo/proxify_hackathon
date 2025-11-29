"""
Model for working with 'cost' documents in Couchbase.
"""

from typing import Optional
from uuid import UUID
from datetime import date

from couchbase_client import CouchbaseModel


class CostModel(CouchbaseModel):
    """
    Model for cost documents.

    This model inherits from CouchbaseModel which provides:
    - Auto-derived collection name (defaults to "cost")
    - CRUD operations as class methods: get(), list(), upsert(), delete()
    - Automatic Pydantic validation
    - Collection initialization
    """

    # Optional: Override collection name (defaults to "cost")
    # collection_name: ClassVar[str] = "cost"

    # Optional: Override key type (defaults to UUID)
    # key_type: ClassVar[type] = UUID

    # Document fields
    # id: UUID  # Primary key - required (inherited but good to be explicit if needed, though CouchbaseModel handles it)
    # We can use UUID for the ID, or use 'Vernr' if it is unique. But typically auto-id is safer.
    # Let's stick to standard pattern with ID and store Vernr as a field.

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
