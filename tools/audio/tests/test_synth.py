"""Checks for synth.py: the same seed gives the same sound, nothing clips, every sound starts and ends in silence,
lengths are what was asked, every kind renders, ambience loops without a seam, a whoosh is loudest in its middle and
an impact at its start.

Run: tools/footage/.venv/bin/python -I -m unittest discover -s tools/audio/tests -p 'test_*.py'
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
    ("buzz", {"seconds": 0.7}), ("buzz", {"seconds": 1.0, "pulses": 3, "on": 0.17, "gap": 0.08}),
    ("tap", {"seconds": 0.14}), ("tap", {"seconds": 0.3, "taps": 2}), ("tap", {"seconds": 0.3, "style": "swipe"}),
    ("ambience", {"seconds": 4, "crossfade": 1, "style": "clean"}),
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
        for style in ("room", "clean", "aircon", "city", "wind", "rain"):
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


def hum_excess(y, lo=30, hi=200):
    """The biggest narrow peak between lo and hi Hz: its level (3 bins, 1 Hz each) above the median of the bins 5 to 25 Hz
    either side, in dB, and where it is. A fan or a mains hum shows as a peak of 10 dB or more."""
    from scipy.signal import welch
    x = mono(y).astype(float)
    f, pw = welch(x, SR, nperseg=SR, noverlap=SR // 2)
    db = 10 * np.log10(pw + 1e-20)
    worst = (-99.0, 0.0)
    for i in range(lo, hi + 1):
        near = np.r_[db[i - 25:i - 4], db[i + 5:i + 26]]
        ex = float(db[i - 1:i + 2].max() - np.median(near))
        if ex > worst[0]:
            worst = (ex, float(f[i]))
    return worst


class PhoneAndGlass(unittest.TestCase):
    def test_new_kinds_are_deterministic_and_seeded(self):
        for kind, s in (("buzz", {"seconds": 0.7}), ("tap", {"seconds": 0.14}), ("tap", {"seconds": 0.3, "style": "swipe"})):
            with self.subTest(kind=kind, **s):
                a, _ = synth.render(kind, dict(s, seed=9))
                b, _ = synth.render(kind, dict(s, seed=9))
                c, _ = synth.render(kind, dict(s, seed=10))
                self.assertTrue(np.array_equal(a, b))
                self.assertFalse(np.array_equal(a, c))

    def test_buzz_is_pulses_with_a_table_ring(self):
        y, _ = render("buzz", {"seconds": 0.7})
        env = np.convolve(mono(y) ** 2, np.ones(SR // 100) / (SR // 100), "same")
        loud = env > 0.1 * env.max()
        edges = np.flatnonzero(np.diff(loud.astype(int)) == 1)
        self.assertEqual(len(edges), 2)                       # two buzzes with a gap between
        # most of its energy is low (a motor and a table), but it is not a bare sine: the case rattle puts energy above 1 kHz
        spec = np.abs(np.fft.rfft(mono(y).astype(float))) ** 2
        f = np.fft.rfftfreq(len(y), 1 / SR)
        self.assertGreater(spec[f < 500].sum(), 0.5 * spec.sum())
        self.assertGreater(spec[f > 1000].sum(), 0.002 * spec.sum())
        self.assertGreater(float(np.mean(np.abs(mono(y)[:SR // 20]))), 0.01)   # it starts at once

    def test_tap_is_short_and_loudest_at_its_start_and_a_swipe_is_in_the_middle(self):
        y, _ = render("tap", {"seconds": 0.14})
        self.assertLess(int(np.argmax(np.abs(y))), int(0.02 * SR))
        s, _ = render("tap", {"seconds": 0.3, "style": "swipe"})
        self.assertTrue(0.2 < int(np.argmax(np.convolve(mono(s) ** 2, np.ones(480) / 480, "same"))) / len(s) < 0.8)

    def test_clean_room_has_no_hum_under_200_hz(self):
        """No narrow peak under 200 Hz more than 6 dB above its neighbours, for several seeds; and the check does see a hum
        (the old room style with its mains hum fails it)."""
        for seed in (1, 11, 51):
            with self.subTest(seed=seed):
                y, _ = synth.render("ambience", {"seconds": 16, "style": "clean", "seed": seed})
                excess, at = hum_excess(y)
                self.assertLessEqual(excess, 6.0, f"a peak {excess:.1f} dB over its neighbours at {at:.0f} Hz")
        old, _ = synth.render("ambience", {"seconds": 16, "style": "room", "seed": 1})
        self.assertGreater(hum_excess(old)[0], 6.0)

    def test_the_library_room_bed_has_no_hum(self):
        path = os.path.join(AUDIO, "..", "..", "library", "sounds", "ambience", "room-clean-01.mp3")
        if not os.path.exists(path):
            self.skipTest("library file not present")
        with tempfile.TemporaryDirectory() as tmp:
            wav = os.path.join(tmp, "r.wav")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ar", str(SR), wav], check=True)
            y, _ = sf.read(wav)
        self.assertEqual(round(len(y) / SR), 16)
        self.assertLessEqual(hum_excess(y)[0], 6.0)


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
