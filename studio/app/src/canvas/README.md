Owned by Worker 3: canvas and inspector (ARCHITECTURE_PLAN.md section 6). Other workers do not change files here.

The film on the canvas: the video, the overlays drawn over it, the "point at an area" box, version compare and the floating toolbar. The safe-zone numbers and where they came from are in `safe-zones.ts`. `bridge.ts` is a stand-in that makes the video follow the playback store; take it out once the playback store drives the video itself.
