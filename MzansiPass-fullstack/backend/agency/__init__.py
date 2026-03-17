"""
Agency module initializer.

Responsible for registering all agency-related blueprints
onto the main Flask application.

This file should:
- Contain NO route logic
- Contain NO business logic
- Only expose register_agency_blueprints(app)
"""

from .trips import agency_trips_bp
from .dashboard import agency_dashboard_bp


def register_agency_blueprints(app):
    """
    Attach all agency blueprints to the Flask app.

    Keeps app.py clean and prevents circular imports.
    """
    app.register_blueprint(agency_trips_bp)
    app.register_blueprint(agency_dashboard_bp)
