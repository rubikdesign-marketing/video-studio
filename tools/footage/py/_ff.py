"""Where ffmpeg and ffprobe are, the same on macOS, Linux and Windows.

FFMPEG and FFPROBE come from, in order: the FFMPEG / FFPROBE environment variables (the Node tools set them from
setup/runtime/resolve.mjs), then whatever is on PATH, then the old Homebrew location.

Programs here run with `python -I`, which does not look beside the script. Add the folder first, then import:

    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from _ff import FFMPEG, FFPROBE
"""
import os
import shutil

_BREW = '/opt/homebrew/opt/ffmpeg-full/bin'


def _find(tool):
    chosen = os.environ.get(tool.upper())
    if chosen:
        return chosen
    found = shutil.which(tool)
    if found:
        return found
    old = os.path.join(_BREW, tool + ('.exe' if os.name == 'nt' else ''))
    return old if os.path.exists(old) else tool


FFMPEG = _find('ffmpeg')
FFPROBE = _find('ffprobe')
