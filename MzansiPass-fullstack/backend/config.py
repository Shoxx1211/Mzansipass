import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Must be explicitly configured. Never use known development secrets for
    # sessions on a publicly reachable beta server.
    SECRET_KEY = os.getenv("SECRET_KEY")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    if SQLALCHEMY_DATABASE_URI and SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=20)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_CSRF_IN_COOKIES = True
    JWT_REFRESH_COOKIE_NAME = "pulse_refresh_token"
    JWT_REFRESH_CSRF_COOKIE_NAME = "pulse_refresh_csrf"
    JWT_REFRESH_COOKIE_PATH = "/"
    JWT_REFRESH_CSRF_COOKIE_PATH = "/"
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_SECURE = os.getenv("PULSE_COOKIE_SECURE", "true").lower() == "true"

    # Existing integration configuration: no secrets should have fallback values.
    PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
    PAYSTACK_PUBLIC_KEY = os.getenv("PAYSTACK_PUBLIC_KEY", "")
    PAYSTACK_BASE = os.getenv("PAYSTACK_BASE", "https://api.paystack.co")
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
