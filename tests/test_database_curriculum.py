from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT))

from build_database_curriculum import (  # noqa: E402
    INTERACTIVE_OUT,
    RUNNER_OUT,
    build_database_curriculum,
)


class DatabaseCurriculumTest(unittest.TestCase):
    def setUp(self) -> None:
        self.curriculum = build_database_curriculum()
        self.tracks = self.curriculum["tracks"]
        self.units = [unit for track in self.tracks for unit in track["units"]]

    def test_top_level_contract_and_route_order(self) -> None:
        self.assertEqual(set(self.curriculum), {"version", "tracks"})
        self.assertEqual([track["id"] for track in self.tracks], ["database", "mysql", "redis"])
        self.assertEqual([len(track["units"]) for track in self.tracks], [6, 9, 8])
        self.assertEqual(len(self.units), 23)

    def test_ids_are_complete_unique_and_ordered(self) -> None:
        expected = (
            [f"db-{index:02d}" for index in range(1, 7)]
            + [f"mysql-{index:02d}" for index in range(1, 10)]
            + [f"redis-{index:02d}" for index in range(1, 9)]
        )
        actual = [unit["id"] for unit in self.units]
        self.assertEqual(actual, expected)
        self.assertEqual(len(actual), len(set(actual)))

    def test_every_unit_has_full_learning_loop(self) -> None:
        required = {
            "id", "track", "title", "number", "goal", "frontendAnalogy",
            "example", "prediction", "challenge", "explanation", "quiz", "next",
        }
        for unit in self.units:
            with self.subTest(unit=unit["id"]):
                self.assertTrue(required.issubset(unit))
                self.assertEqual(set(unit["example"]), {"code", "caption", "output"})
                self.assertEqual(
                    set(unit["prediction"]),
                    {"question", "options", "correctIndex", "explanation"},
                )
                self.assertTrue(
                    {"prompt", "starterCode", "language", "successMessage", "hints"}
                    .issubset(unit["challenge"])
                )
                self.assertEqual(
                    set(unit["explanation"]), {"rule", "steps", "pitfall"}
                )
                self.assertEqual(
                    set(unit["quiz"]),
                    {"question", "options", "correctIndex", "explanation"},
                )
                self.assertEqual(set(unit["next"]), {"label", "target"})
                self.assertGreaterEqual(len(unit["frontendAnalogy"]), 20)
                self.assertGreaterEqual(len(unit["explanation"]["steps"]), 3)
                self.assertGreaterEqual(len(unit["challenge"]["hints"]), 3)
                for check in (unit["prediction"], unit["quiz"]):
                    self.assertGreaterEqual(len(check["options"]), 3)
                    self.assertIn(check["correctIndex"], range(len(check["options"])))

    def test_starters_use_executable_course_languages(self) -> None:
        sql_starts = {"SELECT", "CREATE", "INSERT", "UPDATE", "START"}
        redis_commands = {
            "SET", "GET", "EXISTS", "DEL", "TTL", "PTTL", "PERSIST",
            "HSET", "HGET", "HMGET", "HGETALL", "HINCRBY",
            "SADD", "SISMEMBER", "SMEMBERS", "SCARD", "SREM",
            "ZADD", "ZRANGE", "ZRANK", "ZREM", "INCR",
        }
        for unit in self.units:
            starter = unit["challenge"]["starterCode"].strip()
            language = unit["challenge"]["language"]
            with self.subTest(unit=unit["id"]):
                self.assertTrue(starter)
                self.assertNotIn("____", starter)
                self.assertNotIn("???", starter)
                if language == "sql":
                    self.assertIn(starter.split()[0].upper(), sql_starts)
                elif language == "redis":
                    for line in starter.splitlines():
                        self.assertIn(line.split()[0].upper(), redis_commands)
                else:
                    self.fail(f"unsupported language: {language}")

    def test_next_links_form_routes_and_rejoin_go_course(self) -> None:
        by_id = {unit["id"]: unit for unit in self.units}
        for prefix, count in (("db", 6), ("mysql", 9), ("redis", 8)):
            for index in range(1, count):
                current = f"{prefix}-{index:02d}"
                following = f"{prefix}-{index + 1:02d}"
                self.assertEqual(by_id[current]["next"]["target"], following)
        self.assertEqual(by_id["db-06"]["next"]["target"], "mysql-01")
        self.assertEqual(by_id["mysql-09"]["next"]["target"], "chapter-11")
        self.assertEqual(by_id["redis-08"]["next"]["target"], "chapter-12")

    def test_answer_positions_do_not_teach_a_guessing_pattern(self) -> None:
        for field in ("prediction", "quiz"):
            positions = [unit[field]["correctIndex"] for unit in self.units]
            self.assertEqual(set(positions), {0, 1, 2})
            self.assertLess(max(positions.count(index) for index in set(positions)), 10)

    def test_generated_browser_and_runner_payloads_are_identical(self) -> None:
        expected = self.curriculum
        for target in (INTERACTIVE_OUT, RUNNER_OUT):
            with self.subTest(target=target):
                self.assertTrue(target.exists(), f"run build_database_curriculum.py: {target}")
                self.assertEqual(json.loads(target.read_text(encoding="utf-8")), expected)


if __name__ == "__main__":
    unittest.main()
