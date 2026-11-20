import type { Box } from '../contracts/review';

// The film's video element, kept here so notes can ask for a picture of a moment without reaching into the canvas.
let stage: HTMLVideoElement | null = null;

export const setStageVideo = (el: HTMLVideoElement | null): void => {
  stage = el;
};
export const stageVideo = (): HTMLVideoElement | null => stage;

/** The picture's width in a captured frame, as on the old review page. */
const CAPTURE_WIDTH = 960;

/** Draws what the video shows now, with the marked area if there is one. A JPEG data address, or null if it cannot be read. */
export function drawFrame(video: HTMLVideoElement, box: Box | null): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = CAPTURE_WIDTH;
    canvas.height = Math.round((CAPTURE_WIDTH * (video.videoHeight || 9)) / (video.videoWidth || 16));
    const pen = canvas.getContext('2d');
    if (!pen) return null;
    pen.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (box) {
      // The area is drawn in the theme's accent colour, read from the page so no colour is written here.
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      const [x, y, w, h] = [box.x * canvas.width, box.y * canvas.height, box.w * canvas.width, box.h * canvas.height];
      if (accent) {
        pen.fillStyle = accent;
        pen.strokeStyle = accent;
      }
      pen.globalAlpha = 0.16;
      pen.fillRect(x, y, w, h);
      pen.globalAlpha = 1;
      pen.lineWidth = 4;
      pen.strokeRect(x, y, w, h);
    }
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

/** Goes to a moment of the film, waits for the picture, and captures it. Null when there is no video to read. */
export function captureAt(time: number, box: Box | null, video: HTMLVideoElement | null = stage): Promise<string | null> {
  if (!video || !video.videoWidth) return Promise.resolve(null);
  return new Promise((done) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      video.removeEventListener('seeked', onSeeked);
      requestAnimationFrame(() => done(drawFrame(video, box)));
    };
    const onSeeked = () => finish();
    video.pause();
    if (Math.abs(video.currentTime - time) < 0.001 && !video.seeking) {
      finish();
      return;
    }
    video.addEventListener('seeked', onSeeked);
    setTimeout(finish, 3000);                    // a video that never answers must not hold up sending
    const end = Number.isFinite(video.duration) ? video.duration - 0.001 : time;
    video.currentTime = Math.min(Math.max(0, time), Math.max(0, end));
  });
}
