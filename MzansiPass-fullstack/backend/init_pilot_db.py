"""Initialize a NEW pilot database; refuse to silently upgrade an old schema."""
from sqlalchemy import inspect

from app import app
from models import db


def initialize_database():
    with app.app_context():
        inspector = inspect(db.engine)
        existing = set(inspector.get_table_names())
        required = set(db.metadata.tables)
        if not existing:
            db.create_all()
            print("Initialized empty Pulse pilot database")
            return
        if not required.issubset(existing):
            raise RuntimeError("Database needs a reviewed migration; no tables were changed")
        for name, table in db.metadata.tables.items():
            columns = {column["name"] for column in inspector.get_columns(name)}
            if not set(table.columns.keys()).issubset(columns):
                raise RuntimeError("Database needs a reviewed migration; no tables were changed")
        print("Pulse pilot database schema is present")


if __name__ == "__main__":
    initialize_database()
