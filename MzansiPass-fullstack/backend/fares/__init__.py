"""
MzansiPass Fare Engine
----------------------

This module encapsulates ALL fare calculation logic.

Rules:
- No Flask imports
- No database access
- No side effects
- Pure business logic only

Public API:
- FareContext
- FareEngine
"""

from .context import FareContext
from .engine import FareEngine
from .exceptions import FareCalculationError

__all__ = [
    "FareContext",
    "FareEngine",
    "FareCalculationError",
]
