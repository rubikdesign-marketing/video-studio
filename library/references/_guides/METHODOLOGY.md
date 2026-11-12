# Method and evidence limits

Research date: 20 October 2026 (Asia/Dhaka).

## Scope

All 31 MP4s found in the supplied company folders: Cursor (12), ElevenLabs (9), Grok (10). Original downloads remain in place. The company folder is a user-supplied label, not proof that the company commissioned, published, approved, or paid for a clip. No upload dates, original post captions, engagement statistics, production project files, budgets, or creator contracts were provided. Some videos may be creator commentary, sponsorships, interviews, or reposts. This study describes the supplied sample and cannot establish the complete brand strategy or which clips performed best.

## Local processing

1. FFprobe records dimensions, duration, codecs, audio streams, and SHA-256 file hashes.
2. FFmpeg extracts a representative frame every three seconds using `fps=1/3:start_time=0:round=up`, followed by `scale='min(512,iw)':-2`. Images retain aspect ratio and are never enlarged beyond source width. All supplied videos are 360px wide; upscaling would add no detail. Contact sheets arrange twelve frames with nominal timestamps. The underlying sample frames remain available individually.
3. Three company agents use GPT-6 Luna at low reasoning effort. They inspect sheets and save per-video summaries, then integrate transcripts. The main agent checks coverage and synthesizes the cross-company report. Large video files, raw video bytes, and base64 text are never included in model context.
4. Audio is decoded locally to mono 16kHz PCM WAV. No transcription tool was preinstalled. An isolated environment was created under `_tools/venv`; MLX Whisper small was downloaded once and inference runs locally on this Mac. No paid transcription API is used. Each clip has a timecoded Markdown transcript, JSON with segment confidence fields, and SRT.
5. A local image-change detector records candidates above a 0.30 threshold. These are evidence for large image changes, not a reliable count of editorial cuts. Screen recording motion, flashes, and animations can trigger it; subtle cuts can be missed.
6. Exa searches and primary-source fetches supplement the findings with platform creative guidance, business video research, accessibility advice, and product context.

## How to read claims

- **Observed:** Visible in a sampled frame or present in the transcript. Timecodes identify the source; sampling makes visual beat boundaries approximate.
- **Transcript:** Machine-recognized speech. This is evidence of what was recognized, not independent verification of a product claim. Proper nouns, numbers, overlapping voices, accents, music and silence may be mistranscribed. Check confidence and visual context before reusing a quotation publicly.
- **Inference:** A likely production method or intended audience. The finished image cannot establish exact software, lens, lighting kit, staffing, budget, camera settings, or whether a scene was generated.
- **Recommendation:** A proposed way to reproduce or improve the technique. This is expert guidance and a test hypothesis, not a statement about what the original production team did.

## What three-second samples cannot establish

A rapid hook, single-word caption, transition, or CTA can occur entirely between samples. Absence from a sampled frame does not prove absence from the video. Exact cut duration, frame-accurate synchronization, camera movement, animation easing, music genre, sound effects, mixing quality, voice emotion, and the authenticity of synthetic media require real-time playback/listening or production files. The study does not claim that still frames or automatic speech recognition establish those properties. Audio design in particular should be verified by listening before final imitation. Reported typography describes visible characteristics rather than an unverified font name.

The longest unsampled tail is under three seconds. A CTA near the final frame may therefore be missed. If the report says no CTA is visible, read this as no CTA established in the available sampled evidence. Transcription may still reveal a spoken CTA.

## Cost and reproducibility

Only sampled contact sheets and small relevant text enter model context. One local transcription process reuses one model. Company agents avoid external browsing duplication. Local audio, frames, inventories, scripts, transcripts and citations are retained so the work can be checked and resumed without reprocessing video. No exact account-usage prediction or guarantee is possible; account usage is checked during the run. The parent model handles orchestration and editorial synthesis; the substantive company passes use the requested lower model.

Useful retained files per video: `analysis.md`, `evidence.json`, `metadata.json`, `transcript.md`, `transcript.json`, `transcript.srt`, `contact_*.jpg`, `frames/frame_*.jpg`, `audio.wav`. The WAVs and isolated environment are reproducible intermediates and can be removed later to save disk space; source MP4s and written reports should be retained.
