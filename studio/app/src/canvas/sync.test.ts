import { describe, expect, it } from 'vitest';
import { syncFollower, type VideoLike } from './sync';

/** A pretend video with its own clock, which can run fast or slow like a second decoder does. */
function pretend(speed = 1): VideoLike & { advance(seconds: number): void; seeks: number } {
  let time = 0;
  const video = {
    paused: true,
    playbackRate: 1,
    seeks: 0,
    get currentTime() {
      return time;
    },
    set currentTime(t: number) {
      time = t;
      video.seeks++;
    },
    play() {
      video.paused = false;
    },
    pause() {
      video.paused = true;
    },
    advance(seconds: number) {
      if (!video.paused) time += seconds * video.playbackRate * speed;
    },
  };
  return video;
}

describe('compare keeps two versions in step', () => {
  it.each([
    ['a second video that runs 3% slow', 0.97, 60],
    ['a second video that runs 3% fast', 1.03, 60],
    ['a 30 frames a second film', 0.95, 30],
  ])('stays within one frame with %s', (_name, speed, fps) => {
    const leader = pretend();
    const follower = pretend(speed);
    const frame = 1 / fps;
    leader.play();
    let worst = 0;
    // Ten seconds of film, checked on every screen refresh (60 a second).
    for (let i = 0; i < 600; i++) {
      leader.advance(1 / 60);
      follower.advance(1 / 60);
      syncFollower(leader, follower, fps);
      worst = Math.max(worst, Math.abs(leader.currentTime - follower.currentTime));
      expect(Math.abs(leader.currentTime - follower.currentTime)).toBeLessThanOrEqual(frame);
    }
    expect(worst).toBeLessThanOrEqual(frame / 2 + 1e-9);
    expect(follower.paused).toBe(false);
  });

  it('follows a jump, a pause and a change of speed straight away', () => {
    const leader = pretend();
    const follower = pretend();
    leader.currentTime = 7.25;
    expect(syncFollower(leader, follower, 60)).toBe(true);
    expect(follower.currentTime).toBe(7.25);

    leader.play();
    leader.playbackRate = 0.5;
    syncFollower(leader, follower, 60);
    expect(follower.paused).toBe(false);
    expect(follower.playbackRate).toBe(0.5);

    leader.pause();
    syncFollower(leader, follower, 60);
    expect(follower.paused).toBe(true);
  });

  it('leaves the second video alone when it is already in step', () => {
    const leader = pretend();
    const follower = pretend();
    leader.play();
    syncFollower(leader, follower, 60);          // the second one starts playing with the first
    follower.seeks = 0;
    for (let i = 0; i < 120; i++) {
      leader.advance(1 / 60);
      follower.advance(1 / 60);
      syncFollower(leader, follower, 60);
    }
    expect(follower.seeks).toBe(0);
  });

  it('steps one frame at a time with the first video while paused', () => {
    const leader = pretend();
    const follower = pretend();
    for (let i = 1; i <= 5; i++) {
      leader.currentTime = i / 60;
      syncFollower(leader, follower, 60);
      expect(follower.currentTime).toBe(i / 60);
    }
  });
});
