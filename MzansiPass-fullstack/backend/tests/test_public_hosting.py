"""Acceptance checks for the same-origin public hosting gateway."""
import os
from pathlib import Path
import tempfile
import unittest

from test_passenger_auth import app, db
from werkzeug.test import Client
from werkzeug.wrappers import Response

_build = tempfile.TemporaryDirectory()
_root = Path(_build.name)
(_root / "index.html").write_text("<html>Pulse test build</html>")
(_root / "assets").mkdir()
(_root / "assets" / "app-test.js").write_text("console.log('Pulse')")
os.environ["PULSE_STATIC_DIR"] = _build.name

from public_wsgi import application  # noqa: E402
from init_pilot_db import initialize_database  # noqa: E402


class PublicHostingTests(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        self.client = Client(application, Response)

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_frontend_and_spa_routes(self):
        for path in ("/", "/planner"):
            response = self.client.get(path, buffered=True)
            self.assertEqual(response.status_code, 200)
            self.assertIn(b"Pulse test build", response.data)
            self.assertEqual(response.headers["Cache-Control"], "no-cache")
        asset = self.client.get("/assets/app-test.js", buffered=True)
        self.assertEqual(asset.status_code, 200)
        self.assertIn("immutable", asset.headers["Cache-Control"])

    def test_missing_assets_and_sources_are_not_html(self):
        for path in ("/assets/missing.js", "/src/app/App.tsx", "/missing.png", "/../../config.py"):
            self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.post("/api/missing").status_code, 404)

    def test_health_checks_database(self):
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"status": "ok"})

    def test_account_refresh_through_public_api_mount(self):
        response = self.client.post("/api/auth/register", json={
            "email": "public@example.com",
            "password": "long public commuter test password",
        })
        self.assertEqual(response.status_code, 201)
        self.assertTrue(any("HttpOnly" in item for item in response.headers.getlist("Set-Cookie")))
        csrf = self.client.get_cookie("pulse_refresh_csrf").value
        renewed = self.client.post("/api/auth/refresh", json={}, headers={"X-CSRF-TOKEN": csrf})
        self.assertEqual(renewed.status_code, 200)
        self.assertEqual(self.client.post("/api/cards", json={}).status_code, 403)

    def test_database_initialization_is_empty_only(self):
        initialize_database()
        db.drop_all()
        initialize_database()
        db.session.execute(db.text("DROP TABLE auth_login_throttles"))
        db.session.commit()
        with self.assertRaisesRegex(RuntimeError, "migration"):
            initialize_database()
