from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt
from models import Trip, Transaction
from agency.decorators import agency_required
from extensions import db
from sqlalchemy import func

dashboard_bp = Blueprint("agency_dashboard", __name__, url_prefix="/api/agency/dashboard")

@dashboard_bp.route("/summary")
@agency_required()
def dashboard_summary():
    agency_id = get_jwt()["agency_id"]

    trips_count = db.session.query(func.count(Trip.id))\
        .filter_by(agency_id=agency_id)\
        .scalar()

    revenue = db.session.query(func.sum(Transaction.amount))\
        .filter_by(
            agency_id=agency_id,
            type="fare"
        ).scalar() or 0

    unsettled = db.session.query(func.sum(Transaction.amount))\
        .filter_by(
            agency_id=agency_id,
            settled=False,
            type="fare"
        ).scalar() or 0

    return jsonify({
        "trips": trips_count,
        "revenue": revenue,
        "unsettled": unsettled
    })
