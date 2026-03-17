from flask import Blueprint, request, jsonify
from models import AgencyUser
from extensions import db
from flask_jwt_extended import create_access_token

agency_auth_bp = Blueprint("agency_auth", __name__, url_prefix="/api/agency/auth")

@agency_auth_bp.route("/login", methods=["POST"])
def agency_login():
    data = request.get_json()

    user = AgencyUser.query.filter_by(
        email=data["email"],
        is_active=True
    ).first()

    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_access_token(
        identity={
            "agency_user_id": user.id,
            "agency_id": user.agency_id,
            "role": user.role.value
        }
    )

    return jsonify({
        "access_token": token,
        "role": user.role.value
    })
