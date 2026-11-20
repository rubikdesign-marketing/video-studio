import type { VideoVersion } from '../contracts/film';

const when = (ms: number) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/** "Latest version, 18 Nov 2026, 21:10" or "Earlier version, ...", as on the old review page. */
export function versionLabel(videos: VideoVersion[], file: string): string {
  const index = videos.findIndex((v) => v.file === file);
  const video = videos[index];
  if (!video) return file;
  return `${index === 0 ? 'Latest version' : 'Earlier version'}, ${when(video.modified)}`;
}

export const versionOptions = (videos: VideoVersion[]): { value: string; label: string }[] =>
  videos.map((v) => ({ value: v.file, label: versionLabel(videos, v.file) }));
