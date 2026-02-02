from flask_jwt_extended import verify_jwt_in_request, get_jwt
from functools import wraps
from flask import jsonify

def agency_required(roles=None):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()

            if "agency_id" not in claims:
                return jsonify({"error": "Agency access required"}), 403

            if roles and claims["role"] not in roles:
                return jsonify({"error": "Insufficient role"}), 403

            return fn(*args, **kwargs)
        return decorator
    return wrapper
