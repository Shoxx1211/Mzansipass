import os
import uuid
import math
import requests
from datetime import datetime

from flask import Flask, request, jsonify, abort
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity
)

from config import Config
from models import (
    db, bcrypt,
    User, Card, Trip, Transaction,
    UserRole, TripStatus, TransactionType
)

# Agency / Provider apps
from auth.agency_auth import agency_auth_bp
from agency.dashboard import dashboard_bp
from agency.trips import agency_trips_bp



# =========================================================
# APPLICATION FACTORY
# =========================================================
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Core extensions
    db.init_app(app)
    bcrypt.init_app(app)
    Migrate(app, db)
    JWTManager(app)
    CORS(app)

    # Register provider / agency apps
    app.register_blueprint(agency_auth_bp, url_prefix="/agency")
    app.register_blueprint(dashboard_bp, url_prefix="/agency")
    app.register_blueprint(agency_trips_bp, url_prefix="/agency")

    # =====================================================
    # HEALTH / META
    # =====================================================
    @app.route("/", methods=["GET"])
    def index():
        return jsonify({
            "service": "Mzansi Transit Platform",
            "status": "running",
            "version": "1.0.0"
        })

    # =====================================================
    # AUTH (PASSENGERS)
    # =====================================================
    @app.route("/auth/register", methods=["POST"])
    def register():
        data = request.get_json() or {}
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            abort(400, "Email and password required")

        if User.query.filter_by(email=email).first():
            abort(409, "User already exists")

        user = User(
            email=email,
            name=data.get("name", ""),
            role=UserRole.passenger
        )
        user.set_password(password)

        db.session.add(user)
        db.session.commit()

        return jsonify({"msg": "account_created"}), 201

    @app.route("/auth/login", methods=["POST"])
    def login():
        data = request.get_json() or {}
        user = User.query.filter_by(email=data.get("email")).first()

        if not user or not user.check_password(data.get("password")):
            abort(401, "Invalid credentials")

        token = create_access_token(identity={
            "id": user.id,
            "role": user.role.value
        })

        return jsonify({
            "access_token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "balance": user.balance,
                "role": user.role.value
            }
        })

    # =====================================================
    # CARDS (PASSENGER)
    # =====================================================
    @app.route("/cards", methods=["GET"])
    @jwt_required()
    def list_cards():
        user_id = get_jwt_identity()["id"]
        cards = Card.query.filter_by(user_id=user_id).all()

        return jsonify([{
            "id": c.id,
            "card_id": c.card_id,
            "label": c.label,
            "color": c.color,
            "linked": c.linked
        } for c in cards])

    @app.route("/cards", methods=["POST"])
    @jwt_required()
    def create_card():
        user_id = get_jwt_identity()["id"]
        data = request.get_json() or {}

        card = Card(
            card_id=str(uuid.uuid4()),
            user_id=user_id,
            label=data.get("label", "My Card"),
            color=data.get("color", "#4A90E2"),
            linked=True
        )

        db.session.add(card)
        db.session.commit()

        return jsonify({
            "msg": "card_created",
            "card_id": card.card_id
        }), 201

    # =====================================================
    # TRIPS (NFC CORE)
    # =====================================================
    @app.route("/nfc/tap-in", methods=["POST"])
    @jwt_required()
    def tap_in():
        user_id = get_jwt_identity()["id"]
        data = request.get_json() or {}

        card = Card.query.filter_by(
            card_id=data.get("card_id"),
            user_id=user_id
        ).first()

        if not card:
            abort(404, "Invalid card")

        # Prevent duplicate trips
        active = Trip.query.filter_by(
            user_id=user_id,
            card_id=card.card_id,
            status=TripStatus.in_progress
        ).first()

        if active:
            abort(409, "Trip already in progress")

        trip = Trip(
            user_id=user_id,
            agency_id=data.get("agency_id"),
            card_id=card.card_id,
            start_lat=data.get("lat"),
            start_lng=data.get("lng")
        )

        db.session.add(trip)
        db.session.commit()

        return jsonify({
            "msg": "tap_in_success",
            "trip_id": trip.id
        })

    # -----------------------------
    # Fare engine (isolated logic)
    # -----------------------------
    def calculate_fare(a, b, c, d):
        if None in (a, b, c, d):
            return 10.00

        R = 6371
        lat1, lon1, lat2, lon2 = map(math.radians, [a, b, c, d])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        x = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        dist = 2 * R * math.atan2(math.sqrt(x), math.sqrt(1-x))

        return round(max(6.0, 6.0 + (0.5 * dist)), 2)

    @app.route("/nfc/tap-out", methods=["POST"])
    @jwt_required()
    def tap_out():
        user_id = get_jwt_identity()["id"]
        data = request.get_json() or {}

        trip = Trip.query.filter_by(
            user_id=user_id,
            card_id=data.get("card_id"),
            status=TripStatus.in_progress
        ).with_for_update().first()

        if not trip:
            abort(404, "No active trip")

        user = User.query.get(user_id)

        fare = calculate_fare(
            trip.start_lat, trip.start_lng,
            data.get("lat"), data.get("lng")
        )

        if user.balance < fare:
            abort(402, "Insufficient balance")

        # Close trip
        trip.end_time = datetime.utcnow()
        trip.end_lat = data.get("lat")
        trip.end_lng = data.get("lng")
        trip.fare = fare
        trip.status = TripStatus.completed

        # Deduct balance
        user.balance -= fare

        # Create immutable financial record
        tx = Transaction(
            user_id=user.id,
            agency_id=trip.agency_id,
            amount=fare,
            type=TransactionType.fare,
            reference=f"fare_{uuid.uuid4().hex}",
            meta={
                "trip_id": trip.id,
                "start": [trip.start_lat, trip.start_lng],
                "end": [trip.end_lat, trip.end_lng]
            }
        )

        db.session.add(tx)
        db.session.commit()

        return jsonify({
            "msg": "trip_completed",
            "fare": fare,
            "balance": user.balance
        })

    # =====================================================
    # PAYMENTS (TOP-UP)
    # =====================================================
    @app.route("/topup/initiate", methods=["POST"])
    @jwt_required()
    def initiate_topup():
        user = User.query.get(get_jwt_identity()["id"])
        amount = float(request.json.get("amount", 0))

        if amount <= 0:
            abort(400, "Invalid amount")

        reference = f"ps_{uuid.uuid4().hex}"

        headers = {
            "Authorization": f"Bearer {app.config['PAYSTACK_SECRET_KEY']}"
        }

        resp = requests.post(
            f"{app.config['PAYSTACK_BASE']}/transaction/initialize",
            headers=headers,
            json={
                "email": user.email,
                "amount": int(amount * 100),
                "reference": reference
            },
            timeout=15
        )

        data = resp.json()["data"]

        tx = Transaction(
            user_id=user.id,
            amount=amount,
            type=TransactionType.topup,
            reference=reference,
            meta={"status": "pending"}
        )

        db.session.add(tx)
        db.session.commit()

        return jsonify(data)

    @app.route("/payment/verify/<reference>", methods=["GET"])
    def verify_payment(reference):
        tx = Transaction.query.filter_by(reference=reference).first_or_404()

        if tx.meta.get("status") == "success":
            return jsonify({"msg": "already_verified"})

        headers = {
            "Authorization": f"Bearer {app.config['PAYSTACK_SECRET_KEY']}"
        }

        resp = requests.get(
            f"{app.config['PAYSTACK_BASE']}/transaction/verify/{reference}",
            headers=headers,
            timeout=15
        )

        data = resp.json()["data"]

        if data["status"] == "success":
            user = User.query.get(tx.user_id)
            amount = data["amount"] / 100

            user.balance += amount
            tx.meta.update({
                "status": "success",
                "paystack": data
            })

            db.session.commit()

        return jsonify({"status": data["status"]})

    return app


# =========================================================
# ENTRY POINT
# =========================================================
app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
