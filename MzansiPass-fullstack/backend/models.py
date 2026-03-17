from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from datetime import datetime
import enum

db = SQLAlchemy()
bcrypt = Bcrypt()

# ======================================================
# ENUMS
# ======================================================

class UserRole(enum.Enum):
    user = "user"
    admin = "admin"


class AgencyRole(enum.Enum):
    staff = "staff"
    finance = "finance"
    admin = "admin"


class TripStatus(enum.Enum):
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class TransactionType(enum.Enum):
    topup = "topup"
    fare = "fare"
    refund = "refund"


# ======================================================
# CORE USER (PASSENGERS)
# ======================================================

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    email = db.Column(db.String(180), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    name = db.Column(db.String(120))

    role = db.Column(
        db.Enum(UserRole),
        default=UserRole.user,
        nullable=False
    )

    balance = db.Column(db.Float, default=0.0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Auth helpers
    def set_password(self, password: str):
        self.password_hash = bcrypt.generate_password_hash(password).decode()

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)


# ======================================================
# VIRTUAL / NFC CARDS
# ======================================================

class Card(db.Model):
    __tablename__ = "cards"

    id = db.Column(db.Integer, primary_key=True)

    card_id = db.Column(db.String(120), unique=True, nullable=False)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    label = db.Column(db.String(120))
    color = db.Column(db.String(30))

    linked = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="cards")


# ======================================================
# TRANSPORT AGENCIES (PRASA, REA VAYA, ETC.)
# ======================================================

class TransportAgency(db.Model):
    __tablename__ = "transport_agencies"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)

    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(30))

    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now()
    )


# ======================================================
# AGENCY USERS (PROVIDER PORTAL LOGIN)
# ======================================================

class AgencyUser(db.Model):
    __tablename__ = "agency_users"

    id = db.Column(db.Integer, primary_key=True)

    agency_id = db.Column(
        db.Integer,
        db.ForeignKey("transport_agencies.id"),
        nullable=False,
        index=True
    )

    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

    name = db.Column(db.String(120))

    role = db.Column(
        db.Enum(AgencyRole),
        default=AgencyRole.staff,
        nullable=False
    )

    is_active = db.Column(db.Boolean, default=True)
    last_login_at = db.Column(db.DateTime)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    agency = db.relationship("TransportAgency", backref="users")

    def set_password(self, password: str):
        self.password_hash = bcrypt.generate_password_hash(password).decode()

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)


# ======================================================
# TRIPS (TAP-IN / TAP-OUT CORE)
# ======================================================

class Trip(db.Model):
    __tablename__ = "trips"

    id = db.Column(db.Integer, primary_key=True)

    # Passenger
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    # Transport agency
    agency_id = db.Column(
        db.Integer,
        db.ForeignKey("transport_agencies.id"),
        nullable=False,
        index=True
    )

    # Card used
    card_id = db.Column(
        db.String(120),
        nullable=False,
        index=True
    )

    # Support / audit reference
    reference = db.Column(db.String(120), unique=True)

    # Tap-in
    start_time = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    start_lat = db.Column(db.Float)
    start_lng = db.Column(db.Float)

    # Tap-out
    end_time = db.Column(db.DateTime)
    end_lat = db.Column(db.Float)
    end_lng = db.Column(db.Float)

    # Fare
    fare = db.Column(db.Float, default=0.0)

    status = db.Column(
        db.Enum(TripStatus),
        default=TripStatus.in_progress,
        nullable=False
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="trips")
    agency = db.relationship("TransportAgency", backref="trips")

    __table_args__ = (
        db.Index("idx_trip_agency_time", "agency_id", "start_time"),
        db.Index("idx_trip_user_time", "user_id", "start_time"),
    )

    def complete_trip(self, end_lat, end_lng, fare: float):
        if fare < 0:
            raise ValueError("Fare cannot be negative")

        self.end_time = datetime.utcnow()
        self.end_lat = end_lat
        self.end_lng = end_lng
        self.fare = fare
        self.status = TripStatus.completed


# ======================================================
# TRANSACTIONS (FINANCIAL LEDGER)
# ======================================================

class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    agency_id = db.Column(
        db.Integer,
        db.ForeignKey("transport_agencies.id"),
        nullable=True,
        index=True
    )

    amount = db.Column(db.Float, nullable=False)

    type = db.Column(
        db.Enum(TransactionType),
        nullable=False
    )

    reference = db.Column(db.String(180), unique=True)

    meta = db.Column(db.JSON, default=dict)

    # Provider settlement flag
    settled = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="transactions")
    agency = db.relationship("TransportAgency", backref="transactions")

    __table_args__ = (
        db.Index("idx_transaction_agency_time", "agency_id", "created_at"),
        db.Index("idx_transaction_user_time", "user_id", "created_at"),
    )
