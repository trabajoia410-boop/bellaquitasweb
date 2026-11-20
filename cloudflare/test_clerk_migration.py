"""Pruebas SQLite aisladas de la migracion Clerk. Sin red ni datos reales.
Ejecutar: python3 -m unittest cloudflare/test_clerk_migration.py
"""
from pathlib import Path
import sqlite3
import unittest

MIGRATION = Path(__file__).with_name("migrations").joinpath(
    "0004-clerk-identity-links.sql"
)

class ClerkLinkingMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript("""
            CREATE TABLE profiles (
                id TEXT PRIMARY KEY, points INTEGER NOT NULL DEFAULT 0,
                visits INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE auth_identity_links (
                provider TEXT NOT NULL, provider_subject TEXT NOT NULL,
                profile_id TEXT NOT NULL REFERENCES profiles(id),
                PRIMARY KEY (provider, provider_subject)
            );
            INSERT INTO profiles(id,points,visits) VALUES ('qa-a',25,0),('qa-b',9,0);
            INSERT INTO auth_identity_links(provider,provider_subject,profile_id)
              VALUES ('google','sub-a','qa-a'),('google','sub-b','qa-b');
        """)
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def test_wrong_proof_must_be_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""
                INSERT INTO auth_clerk_links (
                  clerk_user_id,profile_id,link_method,evidence_provider,
                  evidence_subject,confirmed_at)
                VALUES ('user_12345678901234567890','qa-a','migration_confirmed',
                        'google','sub-b',datetime('now'))
            """)
        count = self.db.execute("SELECT count(*) FROM auth_clerk_links").fetchone()[0]
        self.assertEqual(count, 0)

    def test_confirmed_requires_timestamp(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""
                INSERT INTO auth_clerk_links (
                  clerk_user_id,profile_id,link_method,evidence_provider,
                  evidence_subject)
                VALUES ('user_12345678901234567890','qa-a','migration_confirmed',
                        'google','sub-a')
            """)

    def test_pending_cannot_be_used_as_confirmed(self):
        self.db.execute("""
            INSERT INTO auth_clerk_links (
              clerk_user_id,profile_id,link_method,evidence_provider,evidence_subject)
            VALUES ('user_12345678901234567890','qa-a','pending','google','sub-a')
        """)
        self.assertEqual(self.db.execute(
            "SELECT count(*) FROM auth_clerk_links "
            "WHERE link_method='migration_confirmed'").fetchone()[0], 0)
        self.db.execute("""
            UPDATE auth_clerk_links
            SET link_method='migration_confirmed',confirmed_at=datetime('now')
            WHERE clerk_user_id='user_12345678901234567890'
        """)
        self.assertEqual(self.db.execute(
            "SELECT count(*) FROM auth_clerk_links "
            "WHERE link_method='migration_confirmed'").fetchone()[0], 1)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""
                UPDATE auth_clerk_links SET profile_id='qa-b'
                WHERE clerk_user_id='user_12345678901234567890'
            """)
        balances = self.db.execute(
            "SELECT id,points,visits FROM profiles ORDER BY id").fetchall()
        self.assertEqual(balances, [('qa-a',25,0),('qa-b',9,0)])

    def test_schema_is_idempotent(self):
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))
        self.assertEqual(self.db.execute(
            "SELECT count(*) FROM auth_clerk_links").fetchone()[0], 0)

if __name__ == "__main__":
    unittest.main()
