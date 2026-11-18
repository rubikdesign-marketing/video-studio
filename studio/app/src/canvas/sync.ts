/** The parts of a video element the compare view reads and sets, so tests can pass a plain object. */
export interface VideoLike {
  currentTime: number;
  paused: boolean;
  playbackRate: number;
  play(): Promise<void> | void;
  pause(): void;
}

/**
 * Brings the second video into step with the first: same moment, same speed, playing or paused together.
 * Call it on every animation frame while two versions are compared. It corrects as soon as the two are more than
 * half a frame apart, so they are never more than one frame apart after a call. Returns true when it moved the second.
 */
export function syncFollower(leader: VideoLike, follower: VideoLike, fps: number): boolean {
  if (follower.playbackRate !== leader.playbackRate) follower.playbackRate = leader.playbackRate;
  if (leader.paused && !follower.paused) follower.pause();
  if (!leader.paused && follower.paused) void Promise.resolve(follower.play()).catch(() => {});
  const half = 0.5 / Math.max(1, fps);
  if (Math.abs(follower.currentTime - leader.currentTime) <= half) return false;
  follower.currentTime = leader.currentTime;
  return true;
}
