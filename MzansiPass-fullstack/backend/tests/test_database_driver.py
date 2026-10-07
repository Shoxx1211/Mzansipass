"""Catch production PostgreSQL driver failures without a live database."""
import os
from pathlib import Path
import subprocess
import sys
import unittest


class DatabaseDriverTests(unittest.TestCase):
    def test_render_urls_load_installed_driver(self):
        for scheme in ("postgres", "postgresql", "postgresql+psycopg2"):
            with self.subTest(scheme=scheme):
                result = subprocess.run(
                    [sys.executable, "-c", "from config import Config; "
                     "from sqlalchemy import create_engine; "
                     "engine = create_engine(Config.SQLALCHEMY_DATABASE_URI); "
                     "assert engine.dialect.driver == 'psycopg2'; "
                     "assert engine.url.database == 'pulse'; "
                     "assert engine.url.query['sslmode'] == 'require'; "
                     "engine.dispose()"],
                    cwd=Path(__file__).resolve().parents[1],
                    env={**os.environ, "DATABASE_URL":
                         f"{scheme}://test:test@localhost/pulse?sslmode=require"},
                    capture_output=True, text=True,
                )
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_sqlite_still_works(self):
        result = subprocess.run(
            [sys.executable, "-c", "from config import Config; "
             "from sqlalchemy import create_engine; "
             "engine = create_engine(Config.SQLALCHEMY_DATABASE_URI); "
             "assert engine.dialect.name == 'sqlite'; engine.dispose()"],
            cwd=Path(__file__).resolve().parents[1],
            env={**os.environ, "DATABASE_URL": "sqlite:///:memory:"},
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
