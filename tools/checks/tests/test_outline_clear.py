"""Tests for tools/checks/outline_clear.py. Run: tools/footage/.venv/bin/python -m unittest discover -s tools/checks/tests -p 'test_outline*.py'"""
import os, sys, unittest
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import outline_clear  # noqa: E402


def page(w=400, h=300):
    """A plain light page at scale 1."""
    return np.full((h, w, 3), 245, np.uint8)


class Crossing(unittest.TestCase):
    def test_an_outline_on_plain_background_is_clear(self):
        r = outline_clear.crossing(page(), (100, 100, 100, 50), pad=8, scale=1)
        self.assertLess(r, 0.02)

    def test_a_line_of_text_under_the_bottom_edge_is_found(self):
        im = page()
        for x in range(60, 300, 6):           # glyph-like dark strokes on the row the bottom edge runs along
            im[155:162, x:x + 3] = 30
        r = outline_clear.crossing(im, (100, 100, 100, 50), pad=8, scale=1)
        self.assertGreater(r, 0.05)

    def test_scale_two_screenshots_are_read_at_page_pixels(self):
        im = np.full((600, 800, 3), 245, np.uint8)
        im[310:324, 120:520:4] = 30           # text on the bottom edge, at scale 2
        self.assertGreater(outline_clear.crossing(im, (100, 100, 100, 50), pad=8, scale=2), 0.05)
        self.assertLess(outline_clear.crossing(im, (100, 20, 100, 30), pad=8, scale=2), 0.02)

    def test_text_touching_one_edge_only_is_found(self):
        im = page()
        im[161:166, 92:208] = 30               # 3 px under the bottom edge (158), the stroke still reaches it
        self.assertGreater(outline_clear.crossing(im, (100, 100, 100, 50), pad=8, scale=1), 0.05)


class Snug(unittest.TestCase):
    def test_the_bottom_edge_settles_in_the_gap_above_the_next_line(self):
        im = page()
        im[100:150, 100:200] = 40              # the marked thing itself
        im[162:170, 60:300] = 30               # the next line of text
        o = outline_clear.snug(im, (100, 100, 100, 50), scale=1)
        bottom = o[1] + o[3]
        self.assertTrue(154 <= bottom <= 158, bottom)
        self.assertLess(outline_clear.crossing(im, o, pad=0, scale=1), 0.02)

    def test_a_clear_page_keeps_the_preferred_gap(self):
        o = outline_clear.snug(page(), (100, 100, 100, 50), scale=1)
        self.assertEqual(o, (92, 92, 116, 66))


if __name__ == "__main__":
    unittest.main()
