"""Shot changes inside a clip (FOOTAGE-PLAN.md section 3, "Shot changes"), with PySceneDetect.

    python shots.py <edit.mp4> <shots.json>

Hard cuts by the adaptive detector (it compares each frame with its neighbours, so a fast move is not taken for a
cut), and fades to or from black by the threshold detector. Writes {"cuts": [s...], "shots": [{start, end}...]}.
"""
import json
import sys

from scenedetect import AdaptiveDetector, SceneManager, ThresholdDetector, open_video


def main():
    src, dst = sys.argv[1:3]
    video = open_video(src)
    fps = video.frame_rate
    sm = SceneManager()
    sm.auto_downscale = True
    sm.add_detector(AdaptiveDetector(min_scene_len=int(fps * 0.5)))
    sm.add_detector(ThresholdDetector(threshold=12, min_scene_len=int(fps * 0.5)))
    sm.detect_scenes(video, show_progress=False)
    scenes = sm.get_scene_list(start_in_scene=True)
    shots = [{'start': round(a.seconds, 3), 'end': round(b.seconds, 3)} for a, b in scenes]
    if not shots:
        shots = [{'start': 0.0, 'end': round(video.duration.seconds, 3)}]
    cuts = [s['start'] for s in shots[1:]]
    json.dump({'fps': round(float(fps), 3), 'cuts': cuts, 'shots': shots}, open(dst, 'w'), indent=1)
    print(json.dumps({'shots': len(shots), 'cuts': cuts}))


if __name__ == '__main__':
    main()
