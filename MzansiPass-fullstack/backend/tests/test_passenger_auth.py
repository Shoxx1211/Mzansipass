"""Closed-beta security acceptance tests for the passenger auth API.

Run from MzansiPass-fullstack/backend:
  PULSE_BOOTSTRAP_DB=1 python -m unittest discover -s tests -v

Tests use disposable SQLite and explicit non-production test-only secrets.
"""
import os
import unittest

os.environ["SECRET_KEY"] = "beta_test_only_app_secret_" + "x" * 40
os.environ["JWT_SECRET_KEY"] = "beta_test_only_jwt_secret_" + "y" * 40
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["PULSE_COOKIE_SECURE"] = "false"
os.environ["PULSE_BOOTSTRAP_DB"] = "1"

from app import app  # noqa: E402
from models import db  # noqa: E402


class PassengerAuthTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.context = app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        self.client = app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def signup(self, email="commuter@example.com"):
        return self.client.post("/auth/register", json={
            "email": email,
            "password": "long secure commuter passphrase 2026",
        })

    def csrf(self):
        cookie = self.client.get_cookie("pulse_refresh_csrf")
        self.assertIsNotNone(cookie, "Refresh CSRF cookie must be present")
        return {"X-CSRF-TOKEN": cookie.value}

    def test_registration_and_real_password_check(self):
        created = self.signup()
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json["user"]["email"], "commuter@example.com")
        self.assertNotIn("password", created.json["user"])
        invalid = self.client.post("/auth/login", json={
            "email": "commuter@example.com",
            "password": "the wrong password",
        })
        self.assertEqual(invalid.status_code, 401)
        valid = self.client.post("/auth/login", json={
            "email": "commuter@example.com",
            "password": "long secure commuter passphrase 2026",
        })
        self.assertEqual(valid.status_code, 200)
        access = valid.json["access_token"]
        response = self.client.get(
            "/auth/me", headers={"Authorization": f"Bearer {access}"}
        )
        self.assertEqual(response.status_code, 200)

    def test_refresh_requires_csrf_and_rotation_revokes_old_session(self):
        self.assertEqual(self.signup().status_code, 201)
        without_csrf = self.client.post("/auth/refresh", json={})
        self.assertNotEqual(without_csrf.status_code, 200)
        renewed = self.client.post("/auth/refresh", json={}, headers=self.csrf())
        self.assertEqual(renewed.status_code, 200)
        self.assertIn("access_token", renewed.json)
        logged_out = self.client.post("/auth/logout", json={}, headers=self.csrf())
        self.assertEqual(logged_out.status_code, 200)
        cannot_refresh = self.client.post("/auth/refresh", json={})
        self.assertNotEqual(cannot_refresh.status_code, 200)

    def test_login_throttle_and_account_deletion(self):
        self.assertEqual(self.signup().status_code, 201)
        for _ in range(6):
            self.client.post("/auth/login", json={
                "email": "commuter@example.com", "password": "no",
            })
        self.assertEqual(self.client.post("/auth/login", json={
            "email": "commuter@example.com", "password": "no",
        }).status_code, 429)

        access = self.signup("deletable@example.com").json["access_token"]
        wrong = self.client.post("/auth/delete",
            headers={"Authorization": f"Bearer {access}"},
            json={"password": "wrong"},
        )
        self.assertEqual(wrong.status_code, 403)
        deleted = self.client.post("/auth/delete",
            headers={"Authorization": f"Bearer {access}"},
            json={"password": "long secure commuter passphrase 2026"},
        )
        self.assertEqual(deleted.status_code, 200)


if __name__ == "__main__":
    unittest.main()
