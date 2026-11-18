# Timeline: browser check, 18 Nov 2026

Looked at in a real browser (the app's built-in Chromium pane) on the stand-alone timeline page
(`src/timeline/demo.html`) with the sample film (12.2 seconds, 3 scenes) and a 60 frames a second test video of the
same length made with ffmpeg. The test video is not in the repository.

The screenshots are the pane's own captures, which it scales to 800 pixels wide. The page itself was laid out at the
width in each file name.

| File | Width | Theme | Zoom |
|---|---|---|---|
| `1440-night-fitted.jpg` | 1440 | Night | Fitted. Scene 2 is selected, one text has been dragged. |
| `1440-night-zoomed.jpg` | 1440 | Night | 300 pixels a second, at the start of the film |
| `1440-paper-fitted.jpg` | 1440 | Paper | Fitted |
| `1440-paper-zoomed.jpg` | 1440 | Paper | 300 pixels a second, scrolled to the playhead |
| `1440-paper-voice-hidden-text-locked.jpg` | 1440 | Paper | Fitted, Voice lane hidden, Text lane locked |
| `768-night-fitted.jpg` | 768 | Night | Fitted |
| `768-night-zoomed.jpg` | 768 | Night | 300 pixels a second, scrolled to the playhead |
| `768-paper-fitted.jpg` | 768 | Paper | Fitted |
| `768-paper-zoomed.jpg` | 768 | Paper | 300 pixels a second, at the start of the film |

## Checked in the browser

- All five lanes, the ruler and the playhead draw in both themes at both widths, with no sideways page scroll.
- Fit fills the width exactly. Zoomed in, the lanes scroll sideways and the lane names stay put.
- Scrubbing on the ruler: the video went to the time under the pointer (7.5 seconds showed frame 450).
- Real key presses: Right arrow three times moved exactly three frames (no double step with the page-wide shortcut),
  Shift+Z fitted the film, Tab then Enter hid a lane, and ? opened the shortcut sheet listing the playback keys.
- Stepping to frame 123 showed frame 123 in the video. Before a fix made during this check it showed frame 122.
- Dragging a text: nothing was saved during the drag, one edit and one history step after it ("Move the text in
  scene 2"), undo put it back. Dragging an edge onto the playhead snapped and showed the guide line.

## Not checked in the browser

- **Smoothness while playing and scrubbing.** The pane was hidden while this ran, and a hidden page gets no animation
  frames and shows no video frames. So the playhead following the video frame by frame, the 60 frames a second
  scrub, and auto-scroll while playing were not seen. They are covered by tests with a pretend video only.
- **A real 50-second, 9-scene film.** Only the 12-second sample was used. No recorded trace was made.
- **Pinch and Cmd+scroll with a real trackpad.** Tested with made-up wheel events only.
- **Pointer drags with a real mouse.** The drags above were made-up pointer events sent from the console.
- **Touch, Safari and Firefox.**
- At 768 wide the bar above the lanes wraps onto two rows, so at the timeline's starting height (220 pixels) the
  Energy lane is below the fold until the panel is dragged taller or scrolled.
