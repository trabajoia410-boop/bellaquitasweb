"""Prueba offline de vinculación de identidades Clerk. Sin red ni datos reales.

Ejecución: python3 -m unittest discover -s cloudflare -p 'test_clerk_links_guard.py' -v
"""
import sqlite3
import unittest
from pathlib import Path

SQL = Path(__file__).with_name("migrations").joinpath(
    "0008-clerk-verified-links.sql"
).read_text(encoding="utf-8")


class ClerkLinksGuardTests(unittest.TestCase):
    def setUp(self):
        self.con = sqlite3.connect(":memory:")
        self.con.execute("PRAGMA foreign_keys=ON")
        self.con.executescript("""
        CREATE TABLE profiles(
            id TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            points INTEGER NOT NULL,
            lifetime_points INTEGER NOT NULL,
            visits INTEGER NOT NULL
        );
        CREATE TABLE auth_identity_links(
            provider TEXT NOT NULL,
            provider_subject TEXT NOT NULL,
            profile_id TEXT NOT NULL REFERENCES profiles(id),
            PRIMARY KEY(provider,provider_subject)
        );
        INSERT INTO profiles VALUES('qa_a','admin',42,45,3);
        INSERT INTO profiles VALUES('qa_b','socio',5,8,1);
        INSERT INTO auth_identity_links VALUES('google','1111111111111','qa_a');
        INSERT INTO auth_identity_links VALUES('google','2222222222222','qa_b');
        """)
        self.con.executescript(SQL)

    def tearDown(self):
        self.con.close()

    def insert(self, user, profile, provider_sub, state="pending", verified=None):
        self.con.execute(
            "INSERT INTO auth_clerk_links "
            "(clerk_user_id,profile_id,evidence_provider,evidence_subject,"
            "link_method,verified_at) VALUES (?,?, 'google', ?,?,?)",
            (user, profile, provider_sub, state, verified)
        )

    def assert_balances_unchanged(self):
        self.assertEqual(
            self.con.execute(
                "SELECT role,points,lifetime_points,visits "
                "FROM profiles ORDER BY id"
            ).fetchall(),
            [('admin',42,45,3),('socio',5,8,1)]
        )

    def test_source_mismatch_fails(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert("user_0123456789abcdef", "qa_a", "2222222222222")
        self.assertEqual(self.con.execute(
            "SELECT count(*) FROM auth_clerk_links").fetchone()[0], 0)
        self.assert_balances_unchanged()

    def test_unconfirmed_pending_does_not_authorize(self):
        self.insert("user_0123456789abcdef", "qa_a", "1111111111111")
        self.assertEqual(self.con.execute(
            "SELECT count(*) FROM auth_clerk_links "
            "WHERE link_method='migration_confirmed'").fetchone()[0],0)
        self.assert_balances_unchanged()

    def test_confirmed_needs_verified_at(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert("user_0123456789abcdef", "qa_a", "1111111111111",
                        "migration_confirmed", None)

    def test_verified_link_locks_profile_and_evidence(self):
        self.insert("user_0123456789abcdef", "qa_a", "1111111111111",
                    "migration_confirmed", 1795161600)
        for statement in [
            "UPDATE auth_clerk_links SET profile_id='qa_b'",
            "UPDATE auth_clerk_links SET clerk_user_id='user_abcdef1234567890'",
            "UPDATE auth_clerk_links SET evidence_subject='2222222222222'",
            "UPDATE auth_clerk_links SET link_method='pending'",
        ]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.con.execute(statement)
        self.assert_balances_unchanged()

    def test_profile_restriction_prevents_silent_loss(self):
        self.insert("user_0123456789abcdef", "qa_a", "1111111111111",
                    "migration_confirmed", 1795161600)
        with self.assertRaises(sqlite3.IntegrityError):
            self.con.execute("DELETE FROM profiles WHERE id='qa_a'")
        self.assert_balances_unchanged()

    def test_schema_can_reapply_without_rewrites(self):
        self.con.executescript(SQL)
        self.assert_balances_unchanged()


if __name__ == "__main__":
    unittest.main()
