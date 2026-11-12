"""Tests for tools/checks/flashes.py. Run: python3 -m unittest discover -s tools/checks/tests -p 'test_*.py'"""
import os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import flashes  # noqa: E402


def square(hz, fps=60, seconds=2, lo=0.0, hi=1.0):
    """One cell's luminance: a square wave between lo and hi at hz flashes a second."""
    return [hi if (i / fps * hz) % 1 < 0.5 else lo for i in range(int(fps * seconds))]


class Transitions(unittest.TestCase):
    def test_square_wave_counts_two_transitions_a_cycle(self):
        t = flashes.transitions(square(5), 60)
        self.assertGreaterEqual(len(t), 18)          # 5 cycles a second for 2 s, both edges, minus the first
        self.assertLessEqual(len(t), 20)

    def test_small_changes_are_not_transitions(self):
        self.assertEqual(flashes.transitions(square(5, lo=0.40, hi=0.45), 60), [])

    def test_changes_between_two_bright_states_are_not_flashes(self):
        # Both states brighter than 0.8: the darker state is not dark enough to count.
        self.assertEqual(flashes.transitions(square(5, lo=0.85, hi=1.0), 60), [])

    def test_a_slow_fade_is_one_transition(self):
        ramp = [i / 119 for i in range(120)]
        self.assertEqual(len(flashes.transitions(ramp, 60)), 1)


class Verdict(unittest.TestCase):
    def grid(self, flashing_cells, total_cells, hz, fps=60, seconds=2):
        still = [0.2] * int(fps * seconds)
        return [square(hz, fps, seconds) if i < flashing_cells else still for i in range(total_cells)]

    def test_five_flashes_a_second_over_the_whole_frame_fails(self):
        r = flashes.judge(self.grid(100, 100, 5), 60)
        self.assertFalse(r["pass"])
        self.assertGreaterEqual(r["worst"]["flashes"], 4)

    def test_two_flashes_a_second_passes(self):
        self.assertTrue(flashes.judge(self.grid(100, 100, 2), 60)["pass"])

    def test_fast_flashing_in_a_small_area_passes(self):
        r = flashes.judge(self.grid(5, 100, 8), 60)
        self.assertTrue(r["pass"])
        self.assertGreater(r["worst"]["area"], 0)    # but it is reported


def make_clip(path, expr, seconds=3):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=black:s=320x180:r=60:d={seconds}",
                    "-vf", f"format=yuv420p,geq=lum='{expr}':cb=128:cr=128", "-c:v", "libx264", "-crf", "12", path], check=True)


class OnVideo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp(prefix="flash-test-")

    def run_on(self, name, expr):
        p = os.path.join(self.dir, name + ".mp4")
        make_clip(p, expr)
        return flashes.check(p)

    def test_a_full_frame_flashing_at_five_a_second_fails(self):
        self.assertFalse(self.run_on("full5", "if(lt(mod(T*5,1),0.5),235,16)")["pass"])

    def test_a_full_frame_flashing_twice_a_second_passes(self):
        self.assertTrue(self.run_on("full2", "if(lt(mod(T*2,1),0.5),235,16)")["pass"])

    def test_a_corner_flashing_fast_passes(self):
        self.assertTrue(self.run_on("corner8", "if(lt(X,48)*lt(Y,27)*lt(mod(T*8,1),0.5),235,16)")["pass"])


if __name__ == "__main__":
    unittest.main()
