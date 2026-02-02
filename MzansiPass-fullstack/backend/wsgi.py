# wsgi.py
from app import create_app

# Call the factory function to create the WSGI app
app = create_app()
