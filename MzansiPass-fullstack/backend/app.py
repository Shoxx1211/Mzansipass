import os
import uuid
import math
import requests
from datetime import datetime, timedelta
from hashlib import sha256
import re
import secrets

from flask import Flask, request, jsonify, abort, make_response
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    create_refresh_token,
    set_refresh_cookies,
    unset_jwt_cookies,
    jwt_required,
    get_jwt_identity,
    get_jwt
)

from config import Config
from models import (
    db, bcrypt,
    User, Card, Trip, Transaction,
    UserRole, TripStatus, TransactionType,
    RevokedAuthToken, AuthLoginThrottle
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
    for key in ("SECRET_KEY", "JWT_SECRET_KEY"):
        value = str(app.config.get(key) or "")
        if (
            len(value) < 32
            or value.startswith(("CHANGE_ME", "change-", "jwt-secret"))
        ):
            raise RuntimeError(f"Generate a secure {key} before starting Pulse")
    if app.config["SECRET_KEY"] == app.config["JWT_SECRET_KEY"]:
        raise RuntimeError("SECRET_KEY and JWT_SECRET_KEY must be different")
    if not app.config.get("SQLALCHEMY_DATABASE_URI"):
        raise RuntimeError("Set DATABASE_URL before starting Pulse")

    # Core extensions
    db.init_app(app)
    bcrypt.init_app(app)
    Migrate(app, db)
    jwt = JWTManager(app)
    allowed_origins = [
        item.strip()
        for item in os.environ.get(
            "PULSE_ALLOWED_ORIGINS",
            "https://localhost:5173,http://localhost:5173",
        ).split(",") if item.strip()
    ]
    CORS(
        app,
        origins=allowed_origins,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-CSRF-TOKEN"],
    )

    @jwt.token_in_blocklist_loader
    def is_revoked(_header, jwt_payload):
        return db.session.query(RevokedAuthToken.id).filter_by(
            jti=jwt_payload.get("jti"),
        ).first() is not None

    # Development bootstrap for EMPTY pilot databases only. On deployed
    # databases, apply a reviewed schema migration instead of auto-create.
    if os.getenv("PULSE_BOOTSTRAP_DB") == "1":
        with app.app_context():
            db.create_all()

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
    # PASSENGER AUTHENTICATION
    # Password hashes: Flask-Bcrypt. Refresh: HttpOnly/SameSite cookie,
    # CSRF-protected and rotated. Access: short-lived JWT in JS memory.
    # =====================================================
    def public_user(user):
        return {
            "id": str(user.id),
            "email": user.email,
            "name": user.name or user.email.split("@")[0],
            "role": "passenger",
        }

    def issue_tokens(user, old_refresh=None):
        if old_refresh is not None:
            db.session.add(RevokedAuthToken(
                jti=old_refresh["jti"],
                expires_at=datetime.utcfromtimestamp(old_refresh["exp"]),
            ))
            db.session.commit()
        claims = {"role": "passenger"}
        response = jsonify({
            "user": public_user(user),
            "access_token": create_access_token(
                identity=str(user.id),
                additional_claims=claims,
            ),
        })
        set_refresh_cookies(
            response,
            create_refresh_token(
                identity=str(user.id),
                additional_claims=claims,
            ),
        )
        response.headers["Cache-Control"] = "no-store"
        return response

    def throttle_key(email):
        origin = request.remote_addr or "unknown"
        return sha256(f"{origin}|{email}".encode("utf-8")).hexdigest()

    def is_login_locked(key):
        record = db.session.get(AuthLoginThrottle, key)
        if record is None:
            return False
        return bool(record.locked_until and record.locked_until > datetime.utcnow())

    def failed_login(key):
        now = datetime.utcnow()
        record = db.session.get(AuthLoginThrottle, key)
        if record is None:
            record = AuthLoginThrottle(
                key_hash=key, attempts=0, window_started_at=now,
            )
            db.session.add(record)
        if record.window_started_at < now - timedelta(minutes=15):
            record.attempts = 0
            record.window_started_at = now
            record.locked_until = None
        record.attempts += 1
        if record.attempts >= 6:
            record.locked_until = now + timedelta(minutes=15)
        db.session.commit()

    @app.route("/auth/register", methods=["POST"])
    def register():
        data = request.get_json(silent=True) or {}
        email = str(data.get("email", "")).strip().lower()
        password = data.get("password")
        if (
            not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email)
            or len(email) > 180
            or not isinstance(password, str)
            or len(password) < 12
            or len(password) > 128
        ):
            return jsonify({
                "message": "Use a valid email and a password of 12–128 characters.",
            }), 400
        if User.query.filter_by(email=email).first():
            return jsonify({"message": "This email already has an account."}), 409
        user = User(
            email=email,
            name=email.split("@")[0][:120],
            role=UserRole.user,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return issue_tokens(user), 201

    @app.route("/auth/login", methods=["POST"])
    def login():
        data = request.get_json(silent=True) or {}
        email = str(data.get("email", "")).strip().lower()[:180]
        password = data.get("password")
        key = throttle_key(email)
        if is_login_locked(key):
            return jsonify({"message": "Too many attempts. Try again later."}), 429
        if not isinstance(password, str):
            failed_login(key)
            return jsonify({"message": "Invalid email or password."}), 401
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            failed_login(key)
            return jsonify({"message": "Invalid email or password."}), 401
        record = db.session.get(AuthLoginThrottle, key)
        if record:
            db.session.delete(record)
            db.session.commit()
        return issue_tokens(user)

    @app.route("/auth/refresh", methods=["POST"])
    @jwt_required(refresh=True, locations=["cookies"])
    def refresh():
        token = get_jwt()
        if token.get("role") != "passenger":
            return jsonify({"message": "Invalid session."}), 403
        user = db.session.get(User, int(get_jwt_identity()))
        if not user:
            return jsonify({"message": "Session expired."}), 401
        return issue_tokens(user, old_refresh=token)

    @app.route("/auth/me", methods=["GET"])
    @jwt_required(locations=["headers"])
    def me():
        if get_jwt().get("role") != "passenger":
            return jsonify({"message": "Passenger access required."}), 403
        user = db.session.get(User, int(get_jwt_identity()))
        if not user:
            return jsonify({"message": "Account not found."}), 404
        return jsonify({"user": public_user(user)})

    @app.route("/auth/logout", methods=["POST"])
    @jwt_required(refresh=True, locations=["cookies"])
    def logout():
        token = get_jwt()
        db.session.add(RevokedAuthToken(
            jti=token["jti"],
            expires_at=datetime.utcfromtimestamp(token["exp"]),
        ))
        db.session.commit()
        response = jsonify({"message": "Signed out."})
        unset_jwt_cookies(response)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.route("/auth/delete", methods=["POST"])
    @jwt_required(locations=["headers"])
    def delete_account():
        user = db.session.get(User, int(get_jwt_identity()))
        password = (request.get_json(silent=True) or {}).get("password")
        if not user or not isinstance(password, str) or not user.check_password(password):
            return jsonify({"message": "Password confirmation required."}), 403
        # Do not orphan commuter finance data.
        Transaction.query.filter_by(user_id=user.id).delete()
        Trip.query.filter_by(user_id=user.id).delete()
        Card.query.filter_by(user_id=user.id).delete()
        db.session.delete(user)
        db.session.commit()
        response = jsonify({"message": "Account deleted."})
        unset_jwt_cookies(response)
        return response

    # =====================================================
    # CARDS (PASSENGER)
    # =====================================================
    @app.route("/cards", methods=["GET"])
    @jwt_required()
    def list_cards():
        user_id = int(get_jwt_identity())
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
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
