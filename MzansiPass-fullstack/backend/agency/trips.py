from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt
from datetime import datetime
from sqlalchemy.exc import IntegrityError

from models import Trip, TripStatus, Transaction, TransactionType, User
from agency.decorators import agency_required
from models import db
from fares.engine import FareEngine, FareContext

agency_trips_bp = Blueprint(
    "agency_trips",
    __name__,
    url_prefix="/api/agency/trips"
)

# ----------------------------------------------------
# Helpers
# ----------------------------------------------------

def iso(dt):
    return dt.isoformat() if dt else None


def error(code, message, status=400):
    return jsonify({
        "error": code,
        "message": message
    }), status


# ----------------------------------------------------
# LIST TRIPS (AGENCY / ADMIN VIEW)
# ----------------------------------------------------

@agency_trips_bp.route("", methods=["GET"])
@agency_required()
def list_trips():
    claims = get_jwt()
    agency_id = claims["agency_id"]

    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 50)), 100)

    pagination = (
        Trip.query
        .filter_by(agency_id=agency_id)
        .order_by(Trip.start_time.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "items": [
            {
                "id": t.id,
                "card_id": t.card_id,
                "start_time": iso(t.start_time),
                "end_time": iso(t.end_time),
                "fare": t.fare,
                "status": t.status.value
            }
            for t in pagination.items
        ],
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "pages": pagination.pages
        }
    })

@agency_trips_bp.route("/<int:trip_id>", methods=["GET"])
@agency_required()
def get_trip(trip_id):
    agency_id = get_jwt()["agency_id"]

    trip = Trip.query.filter_by(
        id=trip_id,
        agency_id=agency_id
    ).first_or_404()

    return jsonify({
        "id": trip.id,
        "card_id": trip.card_id,
        "start_time": iso(trip.start_time),
        "end_time": iso(trip.end_time),
        "fare": trip.fare,
        "status": trip.status.value,
        "start_lat": trip.start_lat,
        "start_lng": trip.start_lng,
        "end_lat": trip.end_lat,
        "end_lng": trip.end_lng,
    })


# ----------------------------------------------------
# TAP IN (NFC / TERMINAL)
# ----------------------------------------------------

@agency_trips_bp.route("/tap-in", methods=["POST"])
@agency_required()
def tap_in():
    claims = get_jwt()
    agency_id = claims["agency_id"]

    data = request.get_json() or {}
    card_id = data.get("card_id")
    lat = data.get("lat")
    lng = data.get("lng")

    if not card_id:
        return error("invalid_request", "Missing card_id")

    user = User.query.filter_by(card_id=card_id).first()
    if not user:
        return error("card_not_found", "Invalid card", 404)

    active_trip = Trip.query.filter_by(
        user_id=user.id,
        status=TripStatus.in_progress
    ).first()

    if active_trip:
        return error("active_trip_exists", "Trip already in progress", 409)

    # Minimum balance check (policy decision)
    if user.balance < 5.00:
        return error("insufficient_balance", "Minimum balance not met", 402)

    try:
        with db.session.begin():
            trip = Trip(
                user_id=user.id,
                agency_id=agency_id,
                card_id=card_id,
                start_time=datetime.utcnow(),
                start_lat=lat,
                start_lng=lng,
                status=TripStatus.in_progress
            )
            db.session.add(trip)

        return jsonify({
            "status": "ok",
            "trip_id": trip.id,
            "started_at": iso(trip.start_time)
        }), 201

    except IntegrityError:
        db.session.rollback()
        return error("db_error", "Could not start trip", 500)


# ----------------------------------------------------
# TAP OUT (NFC / TERMINAL)
# ----------------------------------------------------

@agency_trips_bp.route("/tap-out", methods=["POST"])
@agency_required()
def tap_out():
    claims = get_jwt()
    agency_id = claims["agency_id"]

    data = request.get_json() or {}
    card_id = data.get("card_id")
    lat = data.get("lat")
    lng = data.get("lng")

    if not card_id:
        return error("invalid_request", "Missing card_id")

    user = User.query.filter_by(card_id=card_id).first()
    if not user:
        return error("card_not_found", "Invalid card", 404)

    trip = Trip.query.filter_by(
        user_id=user.id,
        agency_id=agency_id,
        status=TripStatus.in_progress
    ).first()

    if not trip:
        return error("no_active_trip", "No active trip found", 409)

    # -----------------------------
    # Fare calculation (PURE LOGIC)
    # -----------------------------
    fare_result = FareEngine.calculate(
        FareContext(
            agency="Rea Vaya",  # Later derive from agency_id
            start_lat=trip.start_lat,
            start_lng=trip.start_lng,
            end_lat=lat,
            end_lng=lng,
            start_time=trip.start_time,
            end_time=datetime.utcnow(),
        )
    )

    fare = fare_result.amount

    if user.balance < fare:
        return error("insufficient_balance", "Not enough balance", 402)

    try:
        with db.session.begin():
            trip.end_time = datetime.utcnow()
            trip.end_lat = lat
            trip.end_lng = lng
            trip.fare = fare
            trip.status = TripStatus.completed

            user.balance -= fare

            tx = Transaction(
                user_id=user.id,
                agency_id=agency_id,
                amount=fare,
                type=TransactionType.fare,
                meta={
                    "trip_id": trip.id,
                    "fare_breakdown": fare_result.breakdown
                }
            )
            db.session.add(tx)

        return jsonify({
            "status": "completed",
            "trip_id": trip.id,
            "fare": fare,
            "balance": user.balance
        })

    except IntegrityError:
        db.session.rollback()
        return error("db_error", "Could not complete trip", 500)
