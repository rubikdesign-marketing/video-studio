"""Tests for tools/checks/region_dropout.py. Run: tools/footage/.venv/bin/python -m unittest discover -s tools/checks/tests -p 'test_region*.py'"""
import os, sys, unittest
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import region_dropout  # noqa: E402


def frames(n=40, seed=0):
    """A moving picture: each frame a little different (noise drifting), as video of a person is."""
    rng = np.random.default_rng(seed)
    base = rng.integers(60, 200, (24, 24)).astype(np.float32)
    return [base + 6 * np.sin(i / 3 + base / 40) for i in range(n)]


class Dropouts(unittest.TestCase):
    def test_a_clean_clip_has_none(self):
        self.assertEqual(region_dropout.find(frames(), np.ones(40, bool)), [])

    def test_one_black_frame_is_found(self):
        f = frames(); f[17] = np.zeros_like(f[17])
        got = region_dropout.find(f, np.ones(40, bool))
        self.assertEqual([d['frame'] for d in got], [17])
        self.assertEqual(got[0]['kind'], 'dark')

    def test_one_blank_white_frame_is_found(self):
        f = frames(); f[30] = np.full_like(f[30], 255)
        got = region_dropout.find(f, np.ones(40, bool))
        self.assertEqual([(d['frame'], d['kind']) for d in got], [(30, 'flash')])

    def test_a_region_stuck_while_the_rest_moves_is_found(self):
        f = frames()
        for i in range(20, 26): f[i] = f[19].copy()
        got = region_dropout.find(f, np.ones(40, bool))
        self.assertEqual([d['kind'] for d in got], ['stuck'])
        self.assertEqual(got[0]['frame'], 20)
        self.assertEqual(got[0]['frames'], 6)

    def test_a_still_region_is_fine_when_the_whole_frame_is_still(self):
        f = frames()
        for i in range(20, 26): f[i] = f[19].copy()
        rest_moves = np.ones(40, bool); rest_moves[20:26] = False
        self.assertEqual(region_dropout.find(f, rest_moves), [])


if __name__ == "__main__":
    unittest.main()
