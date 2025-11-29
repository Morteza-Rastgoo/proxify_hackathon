"""
Couchbase models registry.

All models are automatically registered here.
"""

# Import models here
# Example:
# from .users import UserModel

# Registry of all models

from .costs import CostModel
MODELS = [
    # Add model classes here
    # Example: UserModel
    CostModel,
]
