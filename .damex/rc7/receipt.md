# rc7 receipt (local Mac run)

- Source commit: 99257056be8f1d28c6b349f8dad718462d73c331 (RELEASE.json, version 0.1.0-rc7)
- Zip: damex-video-engine-0.1.0-rc7.zip, SHA-256 6e3d47a4b6040c129d111b9f2643ff8b41b08cd2e0f1f37a31731f72dbe49870 (verified before unzip)
- CI run id: not run: waiting for the owner's approval (`gh workflow run zip-start`, Windows and Ubuntu)

## Mac results (Apple Silicon, macOS, folder "Vidéo test/video-engine")
- Start: `env -i HOME=$HOME PATH=/usr/bin:/bin bash setup/start.sh` exit 0, wall 16 s. Printed "The studio is ready (12 s). It uses its own copy of Node, in .runtime/node", 7 core checks passed, and the /video-menu line. Portable Node v22.23.1.
- Sample render: `node setup/runtime/sample.mjs` (portable Node first on PATH) exit 0, 15 s, wrote jobs/_sample/out/sample-preview.mp4, 12.20 s, 0.57 MB.
- Export: studio server started on 127.0.0.1:4317, /editor returned 200. `POST /api/export?job=_sample` with {"ratio":"9:16","height":720,"quality":"preview"} -> requested; the server started the export worker itself; polling /api/exports: requested -> running -> done at about 15 s (worker 11 s). Output export-001-9x16-720.mp4 (692077 bytes).
- Probe (Remotion's bundled ffprobe, the one the studio uses): h264, 406x720, 732 frames, 12.2 s. Request file: export-request.json.

## Not tested
- Step 1, CI on windows-latest and ubuntu-24.04 for this candidate (pending owner approval)
- Physical Windows 11; Linux and Windows on this candidate; Intel Mac; ARM Linux/Windows
- The Export click itself in a browser (the same server API was called directly)
