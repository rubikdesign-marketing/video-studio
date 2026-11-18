"""Tests for tools/audio/beats.py: tempo, beats, bar starts, snap and check on synthetic click tracks.

Run: tools/footage/.venv/bin/python -m unittest tools/audio/tests/test_beats.py
Each test makes its own click track in a temporary folder; nothing is downloaded.
"""
import contextlib, io, json, os, sys, tempfile, unittest

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import beats  # noqa: E402

FIRST = 0.5   # the first click, seconds in


def click_track(path, bpm, seconds=24.0, sr=44100):
    """A click on every beat; every 4th beat (the first, FIRST) is lower and louder, the accent."""
    y = np.zeros(int(sr * seconds))
    period = 60.0 / bpm
    i = 0
    while FIRST + i * period < seconds - 0.2:
        n = int((FIRST + i * period) * sr)
        t = np.arange(int(0.03 * sr)) / sr
        accent = i % 4 == 0
        y[n:n + len(t)] += (1.0 if accent else 0.5) * np.sin(2 * np.pi * (200 if accent else 1500) * t) * np.exp(-t / 0.008)
        i += 1
    sf.write(path, y * 0.8, sr)
    return period


def run(argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            code = beats.main(argv)
        except SystemExit as e:
            code = e.code if isinstance(e.code, int) else 2
    return code, out.getvalue(), err.getvalue()


class GridTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.grids = {}
        for bpm in (120, 96):
            wav = os.path.join(cls.tmp.name, f"click{bpm}.wav")
            period = click_track(wav, bpm)
            code, _, _ = run(["grid", wav, "--fps", "30"])
            assert code == 0
            cls.grids[bpm] = (json.load(open(os.path.join(cls.tmp.name, f"click{bpm}.beats.json"))), period)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_tempo_within_one_bpm(self):
        for bpm, (g, _) in self.grids.items():
            self.assertAlmostEqual(g["tempo_bpm"], bpm, delta=1.0, msg=f"{bpm} bpm track")

    def test_beats_within_20ms(self):
        for bpm, (g, period) in self.grids.items():
            truth = [FIRST + i * period for i in range(int((24.0 - 0.2 - FIRST) / period) + 1)]
            for t in g["beats"]:
                near = min(abs(t - x) for x in truth)
                self.assertLess(near, 0.020, f"{bpm} bpm: beat at {t} is {near * 1000:.0f} ms from a click")
            # and nearly every click has a beat
            for x in truth[1:-1]:
                self.assertLess(min(abs(t - x) for t in g["beats"]), 0.020, f"{bpm} bpm: no beat for the click at {x:.2f}")

    def test_downbeats_land_on_accents(self):
        for bpm, (g, period) in self.grids.items():
            accents = [FIRST + 4 * i * period for i in range(int((24.0 - 0.2 - FIRST) / (4 * period)) + 1)]
            self.assertGreaterEqual(len(g["downbeats"]), 4)
            for d in g["downbeats"]:
                self.assertLess(min(abs(d - a) for a in accents), 0.020, f"{bpm} bpm: bar start {d} is not on an accent")

    def test_first_downbeat_sets_the_bar_phase(self):
        g, period = self.grids[96]
        wav = os.path.join(self.tmp.name, "click96.wav")
        out = os.path.join(self.tmp.name, "shifted.json")
        code, _, _ = run(["grid", wav, "--out", out, "--first-downbeat", str(FIRST + period)])   # say the 2nd click starts a bar
        self.assertEqual(code, 0)
        shifted = json.load(open(out))
        self.assertLess(min(abs(d - (FIRST + period)) for d in shifted["downbeats"]), 0.02)
        self.assertGreater(min(abs(d - FIRST) for d in shifted["downbeats"]), 0.2)               # and no longer the accents
        self.assertIn("by hand", shifted["downbeat_method"])

    def test_grid_fields(self):
        g, _ = self.grids[120]
        for key in ("file", "seconds", "tempo_bpm", "tempo_confidence", "beats", "downbeats", "bars", "meter",
                    "sections", "drop", "notes"):
            self.assertIn(key, g)
        self.assertEqual(g["meter"], 4)
        self.assertGreater(g["tempo_confidence"], 0.7)        # a machine-steady click is steady
        self.assertIsNone(g["drop"])                          # and has no drop
        self.assertTrue(all(1 <= s["energy"] <= 5 for s in g["sections"]))
        self.assertAlmostEqual(g["sections"][-1]["end"], g["seconds"], places=1)
        self.assertTrue(any("assumed" in n or "estimated" in n for n in g["notes"]))   # the notes say what is a guess


class SnapTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.grid = os.path.join(self.tmp.name, "g.beats.json")
        json.dump({"beats": [round(0.5 * i, 3) for i in range(40)], "downbeats": [round(2.0 * i, 3) for i in range(10)]},
                  open(self.grid, "w"))

    def tearDown(self):
        self.tmp.cleanup()

    def test_snaps_to_nearest_beat(self):
        code, out, _ = run(["snap", self.grid, "--cuts", "0,3.2,6.6"])
        self.assertEqual(code, 0)
        self.assertIn("3.000 s", out)       # 3.2 -> 3.0 (0.2 earlier)
        self.assertIn("6.500 s", out)       # 6.6 -> 6.5
        self.assertIn("Snapped cut times: 0.0,3.0,6.5", out)

    def test_reports_cut_too_far(self):
        code, out, _ = run(["snap", self.grid, "--cuts", "3.2", "--within", "0.1"])
        self.assertEqual(code, 1)
        self.assertIn("More than 100 ms", out)

    def test_downbeats(self):
        code, out, _ = run(["snap", self.grid, "--cuts", "3.2", "--to", "downbeats", "--within", "1.5"])
        self.assertEqual(code, 0)
        self.assertIn("4.000 s", out)


class CheckTests(unittest.TestCase):
    """A grid at 120 bpm (a beat every 0.5 s) and a job whose scene lengths are set on, or off, the beat."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.grid = os.path.join(self.tmp.name, "g.beats.json")
        json.dump({"beats": [round(0.5 * i, 3) for i in range(80)], "downbeats": [round(2.0 * i, 3) for i in range(20)]},
                  open(self.grid, "w"))

    def tearDown(self):
        self.tmp.cleanup()

    def job(self, seconds, name="job"):
        d = os.path.join(self.tmp.name, name)
        os.makedirs(d, exist_ok=True)
        json.dump({"scenes": [{"id": f"s{i}", "seconds": s} for i, s in enumerate(seconds)]}, open(os.path.join(d, "shots.json"), "w"))
        return d

    def test_cuts_on_the_beat_pass(self):
        code, out, _ = run(["check", self.grid, self.job([2.5, 3.0, 1.5, 4.0])])
        self.assertEqual(code, 0, out)
        self.assertIn("PASS", out)

    def test_within_one_frame_passes(self):
        # 1 frame at 30 fps is 0.0333 s: a cut 0.03 s late is still inside it
        code, out, _ = run(["check", self.grid, self.job([2.53, 3.0, 2.0])])
        self.assertEqual(code, 0, out)

    def test_three_frames_off_fails(self):
        code, out, _ = run(["check", self.grid, self.job([2.5, 3.1, 2.0])])     # cuts at 2.5 and 5.6: 0.1 s = 3 frames late
        self.assertEqual(code, 1, out)
        self.assertIn("FAIL", out)
        self.assertIn("3.0 frame", out)

    def test_offset_moves_the_beats(self):
        code, _, _ = run(["check", self.grid, self.job([2.75, 2.0]), "--offset", "0.25"])
        self.assertEqual(code, 0)
        code, _, _ = run(["check", self.grid, self.job([2.75, 2.0])])
        self.assertEqual(code, 1)

    def test_cannot_check(self):
        self.assertEqual(run(["check", self.grid, os.path.join(self.tmp.name, "nojob")])[0], 2)       # no shots.json
        self.assertEqual(run(["check", self.grid, self.job([4.0], "one")])[0], 2)                     # no cuts
        d = self.job([2.0, 2.0], "nolen")
        json.dump({"scenes": [{"id": "a", "seconds": 2.0}, {"id": "b"}, {"id": "c", "seconds": 1}]}, open(os.path.join(d, "shots.json"), "w"))
        self.assertEqual(run(["check", self.grid, d])[0], 2)                                          # a scene without seconds
        self.assertEqual(run(["check", os.path.join(self.tmp.name, "none.json"), self.job([2.0, 2.0], "x")])[0], 2)

    def test_cut_after_the_music_ends_fails(self):
        code, out, _ = run(["check", self.grid, self.job([100.0, 5.0], "late")])
        self.assertEqual(code, 1)
        self.assertIn("no beat there", out)


if __name__ == "__main__":
    unittest.main()
