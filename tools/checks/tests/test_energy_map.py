"""Tests for tools/checks/energy_map.py. Run: python3 -m unittest discover -s tools/checks/tests -p 'test_*.py'"""
import os, sys, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import energy_map  # noqa: E402

STEP = 0.25


class Levels(unittest.TestCase):
    def test_motion_maps_to_levels_one_to_five(self):
        self.assertEqual(energy_map.level_of(0.05), 1)
        self.assertEqual(energy_map.level_of(0.5), 2)
        self.assertEqual(energy_map.level_of(1.2), 3)
        self.assertEqual(energy_map.level_of(2.5), 4)
        self.assertEqual(energy_map.level_of(9.0), 5)


class SceneMotion(unittest.TestCase):
    def test_each_scene_gets_the_mean_of_its_quarter_seconds_away_from_its_edges(self):
        motion = [0.1] * 8 + [3.0] * 8          # scene A still for 2 s, scene B busy for 2 s
        scenes = [{"id": "A", "start": 0, "end": 2, "energy": 1}, {"id": "B", "start": 2, "end": 4, "energy": 4}]
        m = energy_map.scene_motion(motion, STEP, scenes)
        self.assertAlmostEqual(m["A"], 0.1, places=3)
        self.assertAlmostEqual(m["B"], 3.0, places=3)


class Judge(unittest.TestCase):
    def test_a_scene_planned_calm_that_moves_a_lot_is_flagged(self):
        rows = [{"id": "S01", "energy": 1, "motion": 4.2}, {"id": "S02", "energy": 4, "motion": 2.4}]
        r = energy_map.judge(rows)
        self.assertFalse(r["pass"])
        self.assertTrue(any(f["scene"] == "S01" and f["kind"] == "more" for f in r["flags"]))

    def test_a_scene_planned_busy_that_hardly_moves_is_flagged(self):
        r = energy_map.judge([{"id": "S01", "energy": 5, "motion": 0.2}])
        self.assertEqual(r["flags"][0]["kind"], "less")

    def test_one_level_off_is_close_enough(self):
        r = energy_map.judge([{"id": "S01", "energy": 3, "motion": 2.5}, {"id": "S02", "energy": 2, "motion": 0.5}])
        self.assertTrue(r["pass"])

    def test_a_shape_turned_upside_down_is_flagged_even_inside_the_bands(self):
        # Planned 2 then 4; measured the other way round.
        r = energy_map.judge([{"id": "S01", "energy": 2, "motion": 1.7}, {"id": "S02", "energy": 4, "motion": 0.9}])
        self.assertFalse(r["pass"])
        self.assertTrue(any(f["kind"] == "order" for f in r["flags"]))

    def test_scenes_with_no_planned_energy_are_skipped(self):
        r = energy_map.judge([{"id": "S01", "energy": None, "motion": 9}])
        self.assertTrue(r["pass"])


if __name__ == "__main__":
    unittest.main()
