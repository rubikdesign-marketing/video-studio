"""Writing one part of a clip's quality.json safely: the other parts are kept, and the file is swapped in whole."""
import json
import os


def update(path, key, value):
    data = {}
    if os.path.exists(path):
        try:
            data = json.load(open(path))
        except ValueError:
            data = {}  # a damaged file from an interrupted run: start again
    data[key] = value
    tmp = f'{path}.part'
    with open(tmp, 'w') as f:
        json.dump(data, f, indent=1, default=float)
    os.replace(tmp, path)
