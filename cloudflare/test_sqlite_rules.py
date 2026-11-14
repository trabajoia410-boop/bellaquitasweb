#!/usr/bin/env python3
"""Pruebas de las migraciones D1 sobre SQLite :memory:, exclusivamente ficticias.

NO conecta a Supabase, Cloudflare ni a ninguna base real.
Usa los SQL del repositorio para reproducir las reglas/trigger reales.
"""
from __future__ import annotations
import json
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parent
MIGRATIONS = ROOT / "migrations"
ADMIN = "00000000-0000-4000-8000-000000000001"
DOOR = "00000000-0000-4000-8000-000000000002"
MEMBER = "00000000-0000-4000-8000-000000000003"
OTHER = "00000000-0000-4000-8000-000000000004"
REWARD = "00000000-0000-4000-8000-000000000005"

class LoyaltyRules(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        for name in ("0001-schema.sql", "0002-auth-and-invariants.sql"):
            self.db.executescript((MIGRATIONS / name).read_text(encoding="utf8"))
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executemany(
            "INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)",
            [
                (ADMIN, "Administrador ficticio", "admin", "MBR-TESTADMIN"),
                (DOOR, "Puerta ficticia", "puerta", "MBR-TESTDOOR"),
                (MEMBER, "Socio ficticio", "socio", "MBR-TESTSOCIO"),
                (OTHER, "Segundo socio ficticio", "socio", "MBR-TESTOTHER"),
            ],
        )
        self.db.execute(
            "INSERT INTO rewards(id,name,cost,active) VALUES (?,?,?,1)",
            (REWARD, "Premio ficticio", 20),
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def profile(self, ident=MEMBER):
        row = self.db.execute("SELECT * FROM profiles WHERE id=?", (ident,)).fetchone()
        return dict(row)

    def visits(self, ident=MEMBER):
        return self.db.execute(
            "SELECT COUNT(*) FROM activity WHERE user_id=? AND type='visita'",
            (ident,),
        ).fetchone()[0]

    def visit(self, ident=MEMBER, staff=DOOR):
        with self.db:
            self.db.execute(
                "INSERT INTO activity(id,user_id,type,delta,detail,staff_id,created_at) "
                "VALUES (lower(hex(randomblob(16))),?,'visita',10,'Visita ficticia',?,datetime('now'))",
                (ident, staff),
            )
            self.db.execute(
                "UPDATE profiles SET points=points+10,lifetime_points=lifetime_points+10,"
                "visits=visits+1 WHERE id=?", (ident,)
            )

    def redemption(self, ident=MEMBER, reward=REWARD):
        self.db.execute(
            "INSERT INTO redemptions(id,code,user_id,reward_id,cost) "
            "VALUES (lower(hex(randomblob(16))),?,?,?,20)",
            ("CNJ-TEST000001", ident, reward),
        )
        self.db.commit()

    def adjust(self, actor=ADMIN, ident=MEMBER, **overrides):
        before = self.profile(ident)
        keys = ("name", "role", "points", "lifetime_points", "visits")
        prev = {k: before[k] for k in keys}
        after = {**prev, **overrides}
        self.db.execute(
            "INSERT INTO admin_member_changes(id,member_id,admin_id,before_data,after_data,reason) "
            "VALUES (lower(hex(randomblob(16))),?,?,?,?,?)",
            (ident, actor, json.dumps(prev), json.dumps(after), "Motivo ficticio válido"),
        )
        self.db.commit()

    def test_qr_visit_adds_exactly_ten_points_once(self):
        self.visit()
        profile = self.profile()
        self.assertEqual((profile["points"], profile["lifetime_points"], profile["visits"]), (10, 10, 1))
        self.assertEqual(self.visits(), 1)

    def test_qr_double_visit_same_day_rolls_back(self):
        self.visit()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "UNIQUE"):
            self.visit()
        self.assertEqual(self.profile()["points"], 10)
        self.assertEqual(self.profile()["visits"], 1)
        self.assertEqual(self.visits(), 1)

    def test_reward_requires_enough_points(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "Puntos insuficientes"):
            self.redemption()
        self.db.rollback()
        self.assertEqual(self.profile()["points"], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM redemptions").fetchone()[0], 0)

    def test_reward_debited_once_and_validated(self):
        self.db.execute("UPDATE profiles SET points=40,lifetime_points=40 WHERE id=?", (MEMBER,))
        self.db.commit()
        self.redemption()
        self.assertEqual(self.profile()["points"], 20)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM activity WHERE type='canje_solicitado'").fetchone()[0], 1)
        with self.db:
            self.db.execute(
                "UPDATE redemptions SET status='validado',validated_by=? WHERE code='CNJ-TEST000001'",
                (DOOR,),
            )
        self.assertEqual(self.profile()["points"], 20)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM activity WHERE type='canje_validado'").fetchone()[0], 1)

    def test_unprivileged_user_cannot_validate_reward(self):
        self.db.execute("UPDATE profiles SET points=40,lifetime_points=40 WHERE id=?", (MEMBER,))
        self.db.commit()
        self.redemption()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "Personal no autorizado"):
            self.db.execute(
                "UPDATE redemptions SET status='validado',validated_by=? WHERE code='CNJ-TEST000001'",
                (OTHER,),
            )
        self.db.rollback()
        self.assertEqual(self.profile()["points"], 20)
        self.assertEqual(self.db.execute("SELECT status FROM redemptions").fetchone()[0], "pendiente")

    def test_canjes_closed_cannot_reopen(self):
        self.db.execute("UPDATE profiles SET points=40,lifetime_points=40 WHERE id=?", (MEMBER,))
        self.db.commit()
        self.redemption()
        with self.db:
            self.db.execute(
                "UPDATE redemptions SET status='validado',validated_by=? WHERE code='CNJ-TEST000001'",
                (DOOR,),
            )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "Este canje ya está cerrado"):
            self.db.execute("UPDATE redemptions SET status='pendiente'")
        self.db.rollback()
        self.assertEqual(self.profile()["points"], 20)

    def test_admin_change_is_applied_and_audited(self):
        self.adjust(points=25, lifetime_points=30, visits=2, role="puerta")
        row = self.profile()
        self.assertEqual((row["points"], row["lifetime_points"], row["visits"], row["role"]), (25, 30, 2, "puerta"))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM admin_member_changes").fetchone()[0], 1)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM activity WHERE type='ajuste_admin'").fetchone()[0], 1)

    def test_door_user_cannot_update_member_points(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "Solo un administrador"):
            self.adjust(actor=DOOR, points=50, lifetime_points=50)
        self.db.rollback()
        self.assertEqual((self.profile()["points"], self.profile()["visits"]), (0, 0))

    def test_last_admin_cannot_be_demoted(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "No puedes quitarte tu rol de administrador"):
            self.adjust(actor=ADMIN, ident=ADMIN, role="socio")
        self.db.rollback()
        self.assertEqual(self.profile(ADMIN)["role"], "admin")

    def test_unreconciled_edit_is_rejected(self):
        before = self.profile()
        fake_before = {
            k: before[k] for k in ("name", "role", "points", "lifetime_points", "visits")
        }
        fake_before["points"] = 12345
        fake_after = {**fake_before, "points": 12346, "lifetime_points": 12346}
        with self.assertRaisesRegex(sqlite3.IntegrityError, "El cambio está desactualizado"):
            self.db.execute(
                "INSERT INTO admin_member_changes(id,member_id,admin_id,before_data,after_data,reason) "
                "VALUES (lower(hex(randomblob(16))),?,?,?,?,?)",
                (MEMBER, ADMIN, json.dumps(fake_before), json.dumps(fake_after), "Motivo ficticio"),
            )
        self.db.rollback()
        self.assertEqual(self.profile()["points"], 0)

if __name__ == "__main__":
    unittest.main(verbosity=2)
