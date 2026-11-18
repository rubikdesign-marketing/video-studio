import { usePlayback } from '../playback';

/**
 * A stand-in. The playback store is meant to drive the video itself once Worker 2's playback lands
 * (the canvas hands the element over with `attachVideo`). Until then nothing moves the video, so this makes it
 * follow the store and tells the store where the video is. Every step checks first and does nothing when the two
 * already agree, so it is harmless next to a store that drives the video. Set this to false to switch it off.
 */
export const VIDEO_FOLLOWS_STORE = false;

/** Makes the video follow the playback store. Returns the function that stops it. */
export function followPlayback(video: HTMLVideoElement): () => void {
  if (!VIDEO_FOLLOWS_STORE || typeof usePlayback.setState !== 'function') return () => {};

  const follow = () => {
    const s = usePlayback.getState();
    if (video.readyState < 1) return;
    // A paused video follows to the frame; a playing one is only pulled back when it is clearly somewhere else.
    const slack = video.paused && !s.playing ? 0.5 / Math.max(1, s.fps) : 0.3;
    if (!video.seeking && Math.abs(video.currentTime - s.time) > slack) video.currentTime = s.time;
    if (video.playbackRate !== s.rate) video.playbackRate = s.rate;
    if (s.playing && video.paused) void video.play().catch(() => usePlayback.setState({ playing: false }));
    if (!s.playing && !video.paused) video.pause();
  };
  const report = () => {
    if (Math.abs(usePlayback.getState().time - video.currentTime) > 0.001) usePlayback.setState({ time: video.currentTime });
  };
  const onEnded = () => {
    if (usePlayback.getState().playing) usePlayback.setState({ playing: false });
  };
  const onMeta = () => {
    if (!usePlayback.getState().duration && Number.isFinite(video.duration)) usePlayback.setState({ duration: video.duration });
    follow();
  };

  const stop = usePlayback.subscribe(follow);
  video.addEventListener('timeupdate', report);
  video.addEventListener('seeked', report);
  video.addEventListener('ended', onEnded);
  video.addEventListener('loadedmetadata', onMeta);
  follow();
  return () => {
    stop();
    video.removeEventListener('timeupdate', report);
    video.removeEventListener('seeked', report);
    video.removeEventListener('ended', onEnded);
    video.removeEventListener('loadedmetadata', onMeta);
  };
}
