"""Tests for tools/audio/mix.py's music chain. Run: tools/footage/.venv/bin/python -m unittest discover -s tools/audio/tests -p 'test_mix.py'"""
import os, sys, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import mix  # noqa: E402


class MusicChain(unittest.TestCase):
    def test_the_music_has_a_mid_pocket_for_the_voice(self):
        c = mix.music_chain(1, 60.0, -18.0, pocket_db=4.5)
        self.assertIn("equalizer=f=2000:t=o:w=2:g=-4.50", c)

    def test_no_pocket_when_asked_for_none(self):
        self.assertNotIn("equalizer", mix.music_chain(1, 60.0, -18.0, pocket_db=0))

    def test_level_and_closing_fade_are_kept(self):
        c = mix.music_chain(2, 60.0, -18.0, pocket_db=4.5)
        self.assertTrue(c.startswith("[2:a]")); self.assertIn("volume=-18.00dB", c); self.assertIn("afade=t=out:st=58.400:d=1.6", c)


if __name__ == "__main__":
    unittest.main()
