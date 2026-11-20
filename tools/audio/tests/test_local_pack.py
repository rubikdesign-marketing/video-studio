"""Tests for tools/audio/local_pack.py. Run: tools/footage/.venv/bin/python -m unittest discover -s tools/audio/tests -p 'test_local*.py'"""
import os, sys, unittest
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import local_pack  # noqa: E402

SR = 22050


def tone(hz, seconds, amp=0.5, attack=0.0):
    t = np.arange(int(SR * seconds)) / SR
    env = np.clip(t / attack, 0, 1) if attack else np.ones_like(t)
    return (amp * env * np.sin(2 * np.pi * hz * t)).astype(np.float32)


class Measure(unittest.TestCase):
    def test_length_and_peak(self):
        m = local_pack.measure(tone(440, 2.0, amp=0.5), SR)
        self.assertAlmostEqual(m['seconds'], 2.0, places=2)
        self.assertAlmostEqual(m['peak_db'], -6.0, delta=0.2)

    def test_a_high_tone_is_brighter_than_a_low_one(self):
        self.assertGreater(local_pack.measure(tone(4000, 1), SR)['centroid_hz'], local_pack.measure(tone(200, 1), SR)['centroid_hz'] * 5)

    def test_attack_is_how_long_it_takes_to_get_loud(self):
        hit = local_pack.measure(tone(300, 1, attack=0.005), SR)['attack_ms']
        swell = local_pack.measure(tone(300, 1, attack=0.6), SR)['attack_ms']
        self.assertLess(hit, 30)
        self.assertGreater(swell, 300)

    def test_silence_does_not_break_it(self):
        m = local_pack.measure(np.zeros(SR, np.float32), SR)
        self.assertEqual(m['peak_db'], -120.0)


class Names(unittest.TestCase):
    def test_group_comes_from_the_folder(self):
        self.assertEqual(local_pack.group_of('450 cinematic sound effects/Whoosh Swoosh sounds - pack 5/x.wav'), 'whoosh')
        self.assertEqual(local_pack.group_of('450 cinematic sound effects/Subdrop Low/x.wav'), 'impact')
        self.assertEqual(local_pack.group_of('450 cinematic sound effects/Buttons/x.wav'), 'click')
        self.assertEqual(local_pack.group_of('230 mixed sound effcts/100 famous sound effects/x.mp3'), 'meme')

    def test_feel_words_come_from_the_file_name(self):
        self.assertEqual(local_pack.feel_words('Soft_Whoosh-Deep 03.wav'), ['soft', 'whoosh', 'deep'])


if __name__ == '__main__':
    unittest.main()
