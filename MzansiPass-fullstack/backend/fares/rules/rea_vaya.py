# fares/rules/rea_vaya.py
from math import hypot
from fares.context import FareContext


class FareResult:
    def __init__(self, amount: float, distance_km: float):
        self.amount = round(amount, 2)
        self.distance_km = round(distance_km, 2)


def calculate_rea_vaya(ctx: FareContext) -> FareResult:
    # Simple distance-based example
    distance = hypot(
        ctx.end_lat - ctx.start_lat,
        ctx.end_lng - ctx.start_lng
    ) * 111  # rough km conversion

    base_fare = 5.00
    per_km = 1.25

    fare = base_fare + (distance * per_km)

    return FareResult(
        amount=fare,
        distance_km=distance
    )
