// Finding and loading a capture made by tools/capture/capture.mjs. `capture.mjs run` puts each best take in
// public/jobs/<job>/capture/<id>/ (recording.mp4, cursor.json, tracks.json) and lists it, newest first, in
// public/captures.json. A capture is named "<job>/<id>"; an empty name means the newest one.
import { useEffect, useState } from 'react';
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';
import type { CaptureCursor, CaptureTracks } from '../kit/capture/data';
import { seenTracks, type CaptureSeen } from '../kit/capture/glue';

type Listed = { capture: string };

export async function getJson<T>(file: string): Promise<T | null> {
  const response = await fetch(staticFile(file));
  return response.ok ? ((await response.json()) as T) : null;
}

/** The capture a name means: the one named, else the newest. Null when there is none. */
export async function resolveCapture(capture: string): Promise<string | null> {
  if (capture) return capture;
  const list = await getJson<Listed[]>('captures.json').catch(() => null);
  return list?.[0]?.capture ?? null;
}

/** "<job>/<id>" lives in public/jobs/<job>/capture/<id>/. */
export const folderOf = (capture: string) => `jobs/${capture.replace('/', '/capture/')}`;

export type LoadedCapture = { name: string; cursor: CaptureCursor; tracks: CaptureTracks | undefined; src: string };

/** Loads a capture's cursor.json and tracks.json (tracks are optional). Null when there is no capture. */
export async function loadCapture(capture: string): Promise<LoadedCapture | null> {
  const name = await resolveCapture(capture);
  if (!name) return null;
  const folder = folderOf(name);
  const cursor = await getJson<CaptureCursor>(`${folder}/cursor.json`).catch(() => null);
  if (!cursor) return null;
  const tracks = (await getJson<CaptureTracks>(`${folder}/tracks.json`).catch(() => null)) ?? undefined;
  // Where the picture really was while the page scrolled (tools/film/seen_scroll.mjs), when it has been measured.
  const seen = tracks ? await getJson<CaptureSeen>(`${folder}/seen.json`).catch(() => null) : null;
  return { name, cursor, tracks: seenTracks(tracks, seen), src: `${folder}/recording.mp4` };
}

/** Loads a capture in a composition, holding the render until it is in. `undefined` while loading, null when none. */
export const useCapture = (capture: string) => {
  const [state, setState] = useState<LoadedCapture | null | undefined>(undefined);
  const [handle] = useState(() => delayRender('Loading the capture'));
  useEffect(() => {
    loadCapture(capture)
      .then((loaded) => {
        setState(loaded);
        continueRender(handle);
      })
      .catch((error: unknown) => cancelRender(error));
  }, [capture, handle]);
  return state;
};
