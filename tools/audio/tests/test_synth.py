"""Checks for synth.py: the same seed gives the same sound, nothing clips, every sound starts and ends in silence,
lengths are what was asked, every kind renders, ambience loops without a seam, a whoosh is loudest in its middle and
an impact at its start.

Run: tools/footage/.venv/bin/python (on Windows: tools/footage/.venv/Scripts/python.exe) -I -m unittest discover -s tools/audio/tests -p 'test_*.py'
"""
import json, os, subprocess, sys, tempfile, unittest

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.dirname(HERE)
sys.path.insert(0, AUDIO)
import synth  # noqa: E402

SR = synth.SR
FRAME = SR // 30                                    # one video frame at 30 fps

# one short take of every kind and style (ambience kept short so the tests stay quick)
CASES = [
    ("whoosh", {"seconds": 0.8}), ("whoosh", {"seconds": 1.2, "pan": 0.8, "tone": "dark", "weight": "heavy"}),
    ("swish", {"seconds": 0.3, "tone": "bright"}),
    ("riser", {"seconds": 2.0}), ("riser", {"seconds": 2.0, "ending": "hit"}), ("riser", {"seconds": 1.5, "ending": "fade"}),
    ("downer", {"seconds": 1.2}), ("downer", {"seconds": 1.2, "attack": "hit"}),
    ("reverse", {"seconds": 1.2}), ("reverse", {"seconds": 1.5, "ending": "hit"}),
    ("impact", {"style": "boom"}), ("impact", {"style": "punch"}), ("impact", {"style": "thud", "weight": "light"}),
    ("impact", {"style": "metallic", "tone": "bright"}),
    ("glitch", {"style": "mixed"}), ("glitch", {"style": "stutter"}), ("glitch", {"style": "crush"}),
    ("glitch", {"style": "chirp"}), ("glitch", {"style": "data", "weight": "heavy"}),
    ("transition", {"style": "whoosh-hit"}), ("transition", {"style": "rise-hit"}), ("transition", {"style": "reverse-hit"}),
    ("transition", {"style": "suck"}), ("transition", {"style": "tape-stop"}), ("transition", {"style": "spin"}),
    ("sting", {"seconds": 2.0}),
    ("ambience", {"seconds": 4, "crossfade": 1, "style": "room"}), ("ambience", {"seconds": 4, "crossfade": 1, "style": "aircon"}),
    ("ambience", {"seconds": 4, "crossfade": 1, "style": "city"}), ("ambience", {"seconds": 4, "crossfade": 1, "style": "wind"}),
    ("ambience", {"seconds": 4, "crossfade": 1, "style": "rain"}),
]

_cache = {}


def render(kind, settings):
    key = (kind, json.dumps(settings, sort_keys=True))
    if key not in _cache:
        _cache[key] = synth.render(kind, dict(settings))
    return _cache[key]


def mono(y):
    return y if y.ndim == 1 else y.mean(axis=1)


class EveryKind(unittest.TestCase):
    def test_every_kind_has_a_case(self):
        self.assertEqual({k for k, _ in CASES}, set(synth.KINDS))

    def test_renders_without_clipping_or_dc(self):
        for kind, s in CASES:
            with self.subTest(kind=kind, **s):
                y, _ = render(kind, s)
                self.assertTrue(np.all(np.isfinite(y)))
                self.assertLessEqual(float(np.max(np.abs(y))), 1.0)
                self.assertAlmostEqual(float(np.max(np.abs(y))), synth.PEAK, places=4)
                self.assertLess(abs(float(np.mean(mono(y)))), 0.01)        # no DC offset

    def test_length_within_one_frame(self):
        for kind, s in CASES:
            with self.subTest(kind=kind, **s):
                y, p = render(kind, s)
                self.assertLessEqual(abs(len(y) - p["seconds"] * SR), FRAME)

    def test_starts_and_ends_near_zero(self):
        for kind, s in CASES:
            if kind == "ambience":
                continue                                    # a loop: tested by its seam instead
            with self.subTest(kind=kind, **s):
                y, _ = render(kind, s)
                self.assertLess(float(np.max(np.abs(y[:2]))), 1e-3)
                self.assertLess(float(np.max(np.abs(y[-2:]))), 1e-3)
                # and no click: the first and last few samples are still inside the fades
                self.assertLess(float(np.max(np.abs(y[:5]))), 0.1)
                self.assertLess(float(np.max(np.abs(y[-5:]))), 0.1)


class Determinism(unittest.TestCase):
    def test_same_seed_same_samples(self):
        for kind in synth.KINDS:
            s = {"seconds": 3, "crossfade": 1} if kind == "ambience" else {}
            with self.subTest(kind=kind):
                a, _ = synth.render(kind, dict(s, seed=7))
                b, _ = synth.render(kind, dict(s, seed=7))
                c, _ = synth.render(kind, dict(s, seed=8))
                self.assertTrue(np.array_equal(a, b))
                self.assertFalse(np.array_equal(a, c))

    def test_recipe_remakes_the_wav_bit_for_bit(self):
        with tempfile.TemporaryDirectory() as tmp:
            first = os.path.join(tmp, "a.wav")
            out = subprocess.run([sys.executable, os.path.join(AUDIO, "synth.py"), "impact", first, "--seed", "5",
                                  "--style", "boom", "--weight", "heavy"], capture_output=True, text=True, check=True)
            recipe = json.loads(out.stdout)["recipe"]
            rpath = os.path.join(tmp, "recipe.json")
            json.dump({"id": "impact/test", "recipe": recipe}, open(rpath, "w"))
            again = os.path.join(tmp, "b.wav")
            subprocess.run([sys.executable, os.path.join(AUDIO, "synth.py"), "recipe", rpath, again],
                           capture_output=True, text=True, check=True)
            self.assertEqual(open(first, "rb").read(), open(again, "rb").read())

    def test_unknown_setting_is_refused(self):
        with self.assertRaises(SystemExit):
            synth.resolve("whoosh", {"wobble": 3})


class Shapes(unittest.TestCase):
    @staticmethod
    def thirds(y):
        e = mono(y).astype(float) ** 2
        return [float(np.sum(a)) for a in np.array_split(e, 3)]

    def test_whoosh_peaks_in_its_middle(self):
        for seed in (1, 2, 3):
            for kind in ("whoosh", "swish"):
                with self.subTest(kind=kind, seed=seed):
                    y, _ = synth.render(kind, {"seed": seed})
                    first, middle, last = self.thirds(y)
                    self.assertGreater(middle, first)
                    self.assertGreater(middle, last)
                    env = np.convolve(mono(y) ** 2, np.ones(480) / 480, "same")
                    self.assertTrue(0.2 < np.argmax(env) / len(env) < 0.8)

    def test_impact_is_loudest_at_its_start(self):
        for style in synth.IMPACT_STYLES:
            with self.subTest(style=style):
                y, _ = synth.render("impact", {"style": style})
                first, middle, last = self.thirds(y)
                self.assertGreater(first, middle)
                self.assertGreater(middle, last)
                env = np.abs(mono(y))
                self.assertLess(np.argmax(env), int(0.15 * SR))   # its loudest sample is in the first 150 ms

    def test_riser_gets_louder(self):
        y, _ = synth.render("riser", {"seconds": 2.0})
        first, middle, last = self.thirds(y)
        self.assertLess(first, middle)
        self.assertLess(middle, last)

    def test_ambience_loops_without_a_seam(self):
        for style in ("room", "aircon", "city", "wind", "rain"):
            with self.subTest(style=style):
                y, _ = render("ambience", {"seconds": 4, "crossfade": 1, "style": style})
                for ch in range(y.shape[1]):
                    x = y[:, ch].astype(float)
                    steps = np.abs(np.diff(x))
                    join = abs(x[0] - x[-1])                  # the step heard when the end runs into the start
                    self.assertLessEqual(join, np.percentile(steps, 99.5))
                    # the level does not jump at the join: the last and first 50 ms are equally loud (within 3 dB)
                    w = SR // 20
                    a, b = np.sqrt(np.mean(x[-w:] ** 2)), np.sqrt(np.mean(x[:w] ** 2))
                    self.assertLess(abs(20 * np.log10(a / b)), 3.0)

    def test_stereo_where_it_helps(self):
        y, _ = render("ambience", {"seconds": 4, "crossfade": 1, "style": "rain"})
        self.assertEqual(y.shape[1], 2)
        corr = np.corrcoef(y[:, 0], y[:, 1])[0, 1]
        self.assertLess(corr, 0.9)                          # the two sides are not the same signal
        s, _ = render("sting", {"seconds": 2.0})
        self.assertEqual(s.shape[1], 2)


class Files(unittest.TestCase):
    def test_wav_written_at_48k(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "s.wav")
            synth.write("swish", out, {"seconds": 0.3})
            info = sf.info(out)
            self.assertEqual(info.samplerate, 48000)
            self.assertEqual(info.frames, round(0.3 * SR))


if __name__ == "__main__":
    unittest.main()
