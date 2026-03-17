# fares/context.py
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class FareContext:
    agency: str
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    start_time: datetime
    end_time: datetime
