"""Tests for tools/audio/mix.py's optional controls: dialogue-priority ducking, per-stem gain, short crossfades, --ref-db.
Run: python3 -m unittest discover -s tools/audio/tests -p 'test_mix_options.py'
All the controls default OFF; the first test pins the exact filter graph a default mix has always produced."""
import math, os, shutil, struct, subprocess, sys, tempfile, unittest, wave
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import mix  # noqa: E402

# The graph mix.py built before these controls existed, for the fixed input in graph() below.
GOLDEN_DEFAULT = "[0:a]aresample=48000,aformat=channel_layouts=mono,highpass=f=80,equalizer=f=3200:t=q:w=1:g=2,acompressor=threshold=-22dB:ratio=3:attack=8:release=120,deesser=i=0.3,pan=stereo|c0=c0|c1=c0,apad=whole_dur=10.000,asplit=2[v][vstem];[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:10.000,volume=-12.00dB,equalizer=f=2000:t=o:w=2:g=-4.50,afade=t=out:st=8.400:d=1.6,apad=whole_dur=10.000[m0];[m0]volume=eval=frame:volume='1-0.2921*min(1\\,max(0\\,min(1\\,min((t-0.750)/0.25\\,(3.450-t)/0.45)))+max(0\\,min(1\\,min((t-4.750)/0.25\\,(7.950-t)/0.45))))',asplit=2[m][mstem];[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=-9.00dB,adelay=1500:all=1[c2];[3:a]aresample=48000,aformat=channel_layouts=stereo,volume=-7.50dB,adelay=4000:all=1[c3];[c2][c3]amix=inputs=2:normalize=0:duration=longest,apad=whole_dur=10.000,atrim=0:10.000,asplit=2[s][sstem];[v][m][s]amix=inputs=3:normalize=0:duration=longest,atrim=0:10.000,alimiter=limit=0.89:attack=2:release=60:level=false,aformat=channel_layouts=stereo[out]"


def graph(opts=None, duration_of=lambda f: 1.0):
    """The -filter_complex build() would hand to ffmpeg for a fixed small mix (ffmpeg is not run)."""
    seen = []
    real_run, real_dur = mix.run, mix.duration
    mix.run, mix.duration = (lambda c: seen.append(c)), duration_of
    try:
        job = tempfile.mkdtemp()
        mix.build(job, 10.0, "/x/music.wav", -12.0,
                  [dict(id="a", file="/x/a.mp3", at=1.5, gain=0.5, gain_db=-9.0), dict(id="b", file="/x/b.mp3", at=4.0, gain=0.5, gain_db=-7.5)],
                  [(1.0, 3.0), (5.0, 7.5)], 4.5, opts)
        shutil.rmtree(job)
    finally:
        mix.run, mix.duration = real_run, real_dur
    return seen[0][seen[0].index("-filter_complex") + 1]


class DefaultsAreOff(unittest.TestCase):
    def test_default_graph_is_what_it_always_was(self):
        self.assertEqual(graph(), GOLDEN_DEFAULT)
        self.assertEqual(graph({}), GOLDEN_DEFAULT)
        self.assertEqual(graph(dict(duck_db=0.0, gain_voice=0.0, gain_music=0.0, gain_sfx=0.0, xfade_ms=0.0)), GOLDEN_DEFAULT)

    def test_each_control_changes_the_graph_when_asked(self):
        for opt in (dict(duck_db=8.0), dict(gain_voice=-2.0), dict(gain_music=-3.0), dict(gain_sfx=1.5), dict(xfade_ms=40.0)):
            self.assertNotEqual(graph(opt), GOLDEN_DEFAULT, opt)


class Controls(unittest.TestCase):
    def test_duck_envelope_is_exact_and_smooth(self):
        v = mix.duck_volume([(1.0, 3.0)], 6.0)
        self.assertIn("volume=eval=frame", v)
        self.assertIn("0.4988", v)                        # 1 - 10^(-6/20): a 6 dB dip
        g = graph(dict(duck_db=6.0))
        self.assertEqual(g.count("0.4988"), 2)           # the music and the effects both duck

    def test_stem_gain_lands_on_the_right_stem(self):
        g = graph(dict(gain_sfx=-4.0))
        self.assertIn("atrim=0:10.000,volume=-4.00dB,asplit=2[s][sstem]", g)
        self.assertIn("volume=-2.00dB,apad", graph(dict(gain_voice=-2.0)))
        self.assertIn("volume=-3.00dB,asplit=2[m][mstem]", graph(dict(gain_music=-3.0)))

    def test_crossfade_fades_both_edges_of_each_effect(self):
        g = graph(dict(xfade_ms=60.0), duration_of=lambda f: 0.5)
        self.assertEqual(g.count("afade=t=in:d=0.060,afade=t=out:st=0.440:d=0.060"), 2)

    def test_crossfade_helper_never_starts_before_zero(self):
        self.assertIn("afade=t=out:st=0.000", mix.cue_fades(0.03, 80.0))


@unittest.skipUnless(shutil.which(mix.FF) or os.path.exists(mix.FF), "ffmpeg is needed")
class RenderedMix(unittest.TestCase):
    """A real mix: a quiet voice line, a steady music bed and one effect. Ducking must lower the bed, and only while the line plays."""
    @classmethod
    def setUpClass(cls):
        cls.job = tempfile.mkdtemp(); A = os.path.join(cls.job, "audio"); os.makedirs(A)
        def tone(path, hz, amp, secs):
            with wave.open(path, "wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
                w.writeframes(b"".join(struct.pack("<h", int(amp * 32767 * math.sin(2 * math.pi * hz * i / 48000))) for i in range(int(48000 * secs))))
        tone(os.path.join(A, "voice.wav"), 220, 0.3, 6.0)
        tone(os.path.join(A, "music.wav"), 330, 0.3, 12.0)
        import json
        json.dump([{"id": "01", "start": 1.0, "end": 4.0}], open(os.path.join(A, "lines.json"), "w"))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.job, ignore_errors=True)

    def stem_db(self, name, a, b):
        s = mix.samples(os.path.join(self.job, "audio", "stems", name))
        return mix.level(s, [(a, b)])

    def run_mix(self, *extra):
        r = subprocess.run([sys.executable, os.path.join(HERE, "..", "mix.py"), self.job, "--tail", "1.5", *extra], capture_output=True, text=True)
        self.assertIn(r.returncode, (0, 1), r.stderr)  # 1 only means the 20-30% music rule is out of range

    def test_ducking_lowers_the_bed_under_the_line_only(self):
        self.run_mix()
        plain_in, plain_out = self.stem_db("music.wav", 1.5, 3.5), self.stem_db("music.wav", 5.2, 7.0)
        self.run_mix("--duck-db", "6")
        duck_in, duck_out = self.stem_db("music.wav", 1.5, 3.5), self.stem_db("music.wav", 5.2, 7.0)
        self.assertAlmostEqual(plain_in - duck_in, 6.0, delta=0.5)
        self.assertAlmostEqual(plain_out - duck_out, 0.0, delta=0.5)

    def test_stem_gain_moves_that_stem_by_that_much(self):
        self.run_mix()
        before = self.stem_db("music.wav", 5.2, 7.0)
        self.run_mix("--gain-music", "-4")
        self.assertAlmostEqual(before - self.stem_db("music.wav", 5.2, 7.0), 4.0, delta=0.5)


@unittest.skipUnless(shutil.which(mix.FF) or os.path.exists(mix.FF), "ffmpeg is needed")
class NoSpokenLine(unittest.TestCase):
    """A film with a placeholder voice and an empty lines.json (no spoken line) used to stop with ZeroDivisionError."""
    def test_mix_runs_with_no_spoken_line(self):
        import json
        job = tempfile.mkdtemp(); A = os.path.join(job, "audio"); os.makedirs(A)
        def tone(path, hz, amp, secs):
            with wave.open(path, "wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
                w.writeframes(b"".join(struct.pack("<h", int(amp * 32767 * math.sin(2 * math.pi * hz * i / 48000))) for i in range(int(48000 * secs))))
        try:
            tone(os.path.join(A, "voice.wav"), 220, 0.0, 4.0)
            tone(os.path.join(A, "music.wav"), 330, 0.3, 10.0)
            json.dump([], open(os.path.join(A, "lines.json"), "w"))
            r = subprocess.run([sys.executable, os.path.join(HERE, "..", "mix.py"), job, "--tail", "1.5", "--ref-db", "-20"], capture_output=True, text=True)
            self.assertNotIn("ZeroDivisionError", r.stderr)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn("no spoken line", r.stdout)
            self.assertTrue(os.path.exists(os.path.join(A, "mix.wav")))
        finally:
            shutil.rmtree(job, ignore_errors=True)


class Limits(unittest.TestCase):
    def test_crossfade_over_80_ms_is_refused(self):
        r = subprocess.run([sys.executable, os.path.join(HERE, "..", "mix.py"), "/nonexistent", "--xfade-ms", "81"], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("outside 0-80", r.stderr)


if __name__ == "__main__":
    unittest.main()
