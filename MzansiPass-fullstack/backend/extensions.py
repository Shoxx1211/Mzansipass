"""Compatibility import for existing agency blueprints.

All database models and agency routes must share the SAME SQLAlchemy instance.
"""
from models import db
