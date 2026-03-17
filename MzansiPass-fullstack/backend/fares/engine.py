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
    user_type: str = "standard"  # student / senior later


@dataclass(frozen=True)
class FareResult:
    amount: float
    currency: str = "ZAR"
    breakdown: dict | None = None


class FareEngine:
    """
    Centralised fare calculation engine.

    This class MUST:
    - Be deterministic
    - Be stateless
    - Never touch DB / Flask
    """

    @staticmethod
    def calculate(context: FareContext) -> FareResult:
        if context.agency == "Rea Vaya":
            return FareEngine._rea_vaya(context)

        if context.agency == "Gautrain":
            return FareEngine._gautrain(context)

        raise ValueError(f"Unsupported agency: {context.agency}")

    # --------------------------------------------------
    # Agency rules
    # --------------------------------------------------

    @staticmethod
    def _rea_vaya(context: FareContext) -> FareResult:
        distance_km = FareEngine._distance_km(
            context.start_lat,
            context.start_lng,
            context.end_lat,
            context.end_lng,
        )

        base_fare = 10.00
        per_km = 1.25

        fare = base_fare + (distance_km * per_km)

        return FareResult(
            amount=round(fare, 2),
            breakdown={
                "base": base_fare,
                "distance_km": round(distance_km, 2),
                "per_km": per_km,
            }
        )

    @staticmethod
    def _gautrain(context: FareContext) -> FareResult:
        # Placeholder – zone-based later
        return FareResult(amount=45.00)

    # --------------------------------------------------
    # Utilities
    # --------------------------------------------------

    @staticmethod
    def _distance_km(lat1, lng1, lat2, lng2) -> float:
        """
        Haversine formula (simplified)
        """
        from math import radians, sin, cos, sqrt, atan2

        R = 6371  # Earth radius in km

        dlat = radians(lat2 - lat1)
        dlng = radians(lng2 - lng1)

        a = sin(dlat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))

        return R * c
