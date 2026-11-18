import type { Film, Scene } from '../contracts/film';

/** A moment as minutes, seconds and hundredths: 0:03.50. */
export function formatTime(t: number): string {
  const time = Math.max(0, t);
  const minutes = Math.floor(time / 60);
  return `${minutes}:${(time - minutes * 60).toFixed(2).padStart(5, '0')}`;
}

/** A length in seconds, without needless zeros: 3.5s. */
export const formatSeconds = (t: number): string => `${Math.round(t * 100) / 100}s`;

export const sceneAt = (film: Film | null, t: number): Scene | null => film?.scenes.find((s) => t >= s.start && t < s.end) ?? null;

/** "Scene 2", or nothing when the scene is not in the film. */
export function sceneName(film: Film | null, id: string | null | undefined): string {
  const index = film && id ? film.scenes.findIndex((s) => s.id === id) : -1;
  return index < 0 ? '' : `Scene ${index + 1}`;
}
