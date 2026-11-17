"""Who speaks (FOOTAGE-PLAN.md section 3, "Who speaks"; section 5.1): each word belongs to a person in the picture, or
to someone off camera.

    python speakers.py <clip_dir>

Reads faces.json (people and their mouths) and words.json; on a two-microphone clip also voice/ch1-words.json and
voice/ch2-words.json from the sound repair (which microphone each word was loudest on). Writes speakers.json:
  people:    [{id, side, words, share}]
  words:     [{i, person, by}]   person: an id, or null (off camera); by: "only face", "mouth", "microphone", "sentence"
  sentences: [{start, end, person}]
The mouth that moves during a word is its speaker: how much each person's mouth opening changes over the word (its
spread, sampled about 15 times a second). A word is given when one mouth moves clearly more than the others; then
each sentence takes the person most of its words had, so a pause or a closed vowel does not flip the speaker.
"""
import json
import os
import sys

import numpy as np

ENDS = ('.', '?', '!')


def load(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def activity(person, start, end):
    """How much this person's mouth moves between start and end (the spread of its opening), or None if unseen."""
    vals = [f['mouth'] for f in person['frames'] if f and start - 0.05 <= f['t'] <= end + 0.05]
    if len(vals) < 2:
        return None
    v = np.array(vals)
    return float(v.max() - v.min() + v.std())


def sentences(words):
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        nxt = words[i + 1] if i + 1 < len(words) else None
        if not nxt or w['text'].rstrip().endswith(ENDS) or nxt['start'] - w['end'] > 0.8:
            out.append(cur); cur = []
    return out


def main():
    d = sys.argv[1]
    faces = load(os.path.join(d, 'faces.json'), {})
    words = load(os.path.join(d, 'words.json'), {}).get('words', [])
    people = faces.get('people', [])
    result = [{'i': i, 'person': None, 'by': None} for i in range(len(words))]
    if len(people) == 1:
        for r in result:
            r['person'], r['by'] = people[0]['id'], 'only face'
    elif len(people) > 1:
        for i, w in enumerate(words):
            acts = [(activity(p, w['start'], w['end']), p['id']) for p in people]
            acts = [(a, pid) for a, pid in acts if a is not None]
            if len(acts) < 2:
                continue
            acts.sort(reverse=True)
            (a1, p1), (a2, _) = acts[0], acts[1]
            if a1 > 0.004 and a1 > 1.6 * a2:
                result[i]['person'], result[i]['by'] = p1, 'mouth'
        # A two-microphone clip: the microphone that hears a word best says who spoke it, where the mouths did not.
        mics = [load(os.path.join(d, 'voice', f'ch{k}-words.json'), {}).get('words', []) for k in (1, 2)]
        if all(mics):
            mic_of = {}
            for k, ws in enumerate(mics):
                for w in ws:
                    mic_of[round(w['start'], 3)] = k
            agree = {}
            for i, w in enumerate(words):
                k = mic_of.get(round(w['start'], 3)); p = result[i]['person']
                if k is not None and p is not None:
                    agree.setdefault(k, {}).setdefault(p, 0); agree[k][p] += 1
            mic_person = {k: max(v, key=v.get) for k, v in agree.items()}
            for i, w in enumerate(words):
                k = mic_of.get(round(w['start'], 3))
                if result[i]['person'] is None and k in mic_person:
                    result[i]['person'], result[i]['by'] = mic_person[k], 'microphone'
        # Each sentence takes the person most of its words had.
        for s in sentences(words):
            votes = [result[i]['person'] for i in s if result[i]['person'] is not None]
            if not votes:
                continue
            top = max(set(votes), key=votes.count)
            for i in s:
                if result[i]['person'] != top:
                    result[i]['person'], result[i]['by'] = top, 'sentence'
    counts = {p['id']: sum(1 for r in result if r['person'] == p['id']) for p in people}
    sents = []
    for s in sentences(words):
        ps = [result[i]['person'] for i in s]
        sents.append({'start': words[s[0]]['start'], 'end': words[s[-1]]['end'], 'person': max(set(ps), key=ps.count) if ps else None})
    out = {'people': [{'id': p['id'], 'side': p['side'], 'words': counts[p['id']], 'share': round(counts[p['id']] / max(1, len(words)), 2)} for p in people],
           'off_camera_words': sum(1 for r in result if r['person'] is None), 'words': result, 'sentences': sents}
    with open(os.path.join(d, 'speakers.json'), 'w') as f:
        json.dump(out, f, indent=1)
    print(json.dumps({'people': out['people'], 'off_camera_words': out['off_camera_words']}))


if __name__ == '__main__':
    main()
