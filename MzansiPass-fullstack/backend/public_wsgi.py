"""Serve the built Pulse app and passenger API on a single HTTPS origin."""
import os
from pathlib import Path

from flask import Flask, abort, jsonify, send_from_directory
from sqlalchemy import text
from werkzeug.middleware.dispatcher import DispatcherMiddleware

from app import app as api
from models import db


def create_frontend(static_dir):
    directory = Path(static_dir).resolve()
    if not (directory / "index.html").is_file():
        raise RuntimeError("Build the Pulse frontend before starting the public server")
    frontend = Flask("pulse_public", static_folder=None)

    @frontend.route("/healthz")
    def health():
        with api.app_context():
            db.session.execute(text("SELECT 1"))
        return jsonify(status="ok")

    @frontend.route("/", defaults={"path": ""})
    @frontend.route("/<path:path>")
    def spa(path):
        target = (directory / path).resolve()
        if not target.is_relative_to(directory):
            abort(404)
        if path and target.is_file():
            response = send_from_directory(directory, path)
            if path.startswith("assets/"):
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            else:
                response.headers["Cache-Control"] = "no-cache"
            return response
        # Never return HTML for a missing JS, icon, API or source file.
        if path.startswith(("api/", "assets/", "src/", "icons/")) or "." in Path(path).name:
            abort(404)
        response = send_from_directory(directory, "index.html")
        response.headers["Cache-Control"] = "no-cache"
        return response

    @frontend.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    return frontend


application = DispatcherMiddleware(
    create_frontend(os.environ.get("PULSE_STATIC_DIR", "../../frontend/dist")),
    {"/api": api},
)
