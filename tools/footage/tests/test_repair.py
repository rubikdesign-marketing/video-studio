"""Tests for the sound repair steps (FOOTAGE-PLAN.md phase 3), on small synthetic signals with known answers.
Run: tools/footage/.venv/bin/python -I -m unittest discover -s tools/footage/tests -p 'test_*.py'
"""
import json
import os
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'py'))
import repair  # noqa: E402

R = repair.RATE


def band_db(x, f, width=3):
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    freqs = np.fft.rfftfreq(len(x), 1 / R)
    m = np.abs(freqs - f) <= width
    return 20 * np.log10(spec[m].max() + 1e-12)


class RepairTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def path(self, name):
        return os.path.join(self.dir, name)

    def write_words(self, words):
        with open(self.path('w.json'), 'w') as f:
            json.dump({'words': words}, f)

    def test_hum_notches_the_mains_and_keeps_the_voice(self):
        t = np.arange(R * 2) / R
        x = 0.2 * np.sin(2 * np.pi * 50 * t) + 0.1 * np.sin(2 * np.pi * 150 * t) + 0.2 * np.sin(2 * np.pi * 1000 * t)
        repair.save(self.path('in.wav'), x)
        r = repair.hum(self.path('in.wav'), self.path('out.wav'), 50)
        y = repair.load(self.path('out.wav'))
        self.assertIn(50, r['notches_hz'])
        self.assertLess(band_db(y, 50) - band_db(x, 50), -20)
        self.assertLess(band_db(y, 150) - band_db(x, 150), -20)
        self.assertLess(abs(band_db(y, 1000) - band_db(x, 1000)), 1)

    def test_sync_finds_the_recorder_to_the_sample(self):
        rng = np.random.default_rng(3)
        bursts = np.zeros(R * 6)
        for s in (0.5, 1.7, 2.2, 3.9, 4.4):
            n = int(0.3 * R)
            bursts[int(s * R):int(s * R) + n] = rng.standard_normal(n) * np.hanning(n) * 0.3
        lead = 12345  # the recorder started 12345 samples (0.257 s) before the camera
        camera = bursts + rng.standard_normal(len(bursts)) * 0.003
        recorder = np.concatenate([rng.standard_normal(lead) * 0.003, bursts * 0.8])
        repair.save(self.path('cam.wav'), camera); repair.save(self.path('rec.wav'), recorder)
        r = repair.sync(self.path('cam.wav'), self.path('rec.wav'))
        self.assertLessEqual(abs(r['lead_samples'] - lead), 2)
        self.assertGreater(r['match'], 0.5)

    def test_tone_matching_undoes_a_tilt_and_refuses_another_voice(self):
        rng = np.random.default_rng(5)
        t = np.arange(R * 4) / R
        voice = sum(np.sin(2 * np.pi * 140 * k * t) / k for k in range(1, 30)) * 0.05 + rng.standard_normal(len(t)) * 0.002
        words = [{'text': 'a', 'start': 0.1, 'end': 3.9}]
        self.write_words(words)
        from scipy.signal import butter, sosfiltfilt
        dull = sosfiltfilt(butter(1, 1500, 'lowpass', fs=R, output='sos'), voice)
        repair.save(self.path('ref.wav'), voice); repair.save(self.path('dull.wav'), dull)
        r = repair.tone(self.path('ref.wav'), self.path('dull.wav'), self.path('w.json'), self.path('w.json'))
        self.assertTrue(r['same_voice'])
        self.assertGreater(r['bands_db'][-1], r['bands_db'][0] + 3)  # the dull copy gets its top end back
        other = sum(np.sin(2 * np.pi * 230 * k * t) / k for k in range(1, 20)) * 0.05
        repair.save(self.path('other.wav'), other)
        self.assertFalse(repair.tone(self.path('ref.wav'), self.path('other.wav'), self.path('w.json'), self.path('w.json'))['same_voice'])

    def test_breaths_are_lowered_not_removed(self):
        rng = np.random.default_rng(7)
        x = rng.standard_normal(R * 3) * 0.0005
        x[int(0.2 * R):int(1.0 * R)] += np.sin(2 * np.pi * 180 * np.arange(int(0.8 * R)) / R) * 0.2
        x[int(1.4 * R):int(1.7 * R)] += rng.standard_normal(int(0.3 * R)) * 0.02 * np.hanning(int(0.3 * R))  # a breath
        x[int(2.1 * R):int(2.9 * R)] += np.sin(2 * np.pi * 180 * np.arange(int(0.8 * R)) / R) * 0.2
        self.write_words([{'text': 'one', 'start': 0.2, 'end': 1.0}, {'text': 'two', 'start': 2.1, 'end': 2.9}])
        repair.save(self.path('in.wav'), x)
        r = repair.breaths(self.path('in.wav'), self.path('out.wav'), self.path('w.json'), 8)
        y = repair.load(self.path('out.wav'))
        seg = slice(int(1.45 * R), int(1.65 * R))
        drop = 10 * np.log10(np.mean(x[seg] ** 2) / np.mean(y[seg] ** 2))
        self.assertEqual(r['breaths'], 1)
        self.assertTrue(5 < drop < 10, drop)  # lowered by about 8 dB, still there

    def test_bleed_turns_down_only_where_the_other_person_speaks(self):
        t = np.arange(R * 4) / R
        a = np.where(t < 2, np.sin(2 * np.pi * 200 * t) * 0.3, 0)
        b = np.where(t >= 2, np.sin(2 * np.pi * 120 * t) * 0.3, 0)
        mic_a = a + 0.18 * b; mic_b = b + 0.18 * a
        repair.save(self.path('a.wav'), mic_a); repair.save(self.path('b.wav'), mic_b)
        repair.bleed(self.path('a.wav'), self.path('b.wav'), self.path('out.wav'))
        y = repair.load(self.path('out.wav'))
        own = 10 * np.log10(np.mean(y[int(0.5 * R):int(1.5 * R)] ** 2) / np.mean(mic_a[int(0.5 * R):int(1.5 * R)] ** 2))
        other = 10 * np.log10(np.mean(y[int(2.5 * R):int(3.5 * R)] ** 2) / np.mean(mic_a[int(2.5 * R):int(3.5 * R)] ** 2))
        self.assertGreater(own, -1)  # its own speaker untouched
        self.assertLess(other, -12)  # the other person's bleed turned down


if __name__ == '__main__':
    unittest.main()
