# Demo video handoff

The public app, Chrome WebMCP flow, narration, prompts, and shot timings are ready. The final MP4 and owner-authorized source voice remain outside Git under ignored `submission/video/`; their exact hashes are recorded in checked-in receipts.

## Record

1. Use the production app at https://semantic-spatial-webmcp.swmengappdev.workers.dev/.
2. Generate and align the timed narration from the exact owner-authorized sample:

```bash
npm run generate:demo-narration -- --reference-audio <owner-authorized-voice-sample.m4a>
npm run verify:demo-narration
```

3. Capture the paced Chrome 151 WebMCP replay. It uses an isolated profile, a 30 fps output timeline, and ten storyboard-specific hold durations so each real WebMCP result remains visible for its narration section. CDP captures only the page viewport. It never captures private tabs, notifications, bookmarks, or account details.

```bash
npm run verify:webmcp:chrome -- \
  --url https://semantic-spatial-webmcp.swmengappdev.workers.dev/ \
  --headed \
  --video-fps 30 \
  --start-delay 20000 \
  --step-delays 3000,7000,5000,22000,14000,21000,36000,16000,8000,9000 \
  --outro-delay 3000 \
  --outro-url https://github.com/Whyme-Labs/semantic-spatial-webmcp \
  --hold 11000 \
  --video submission/video/chrome-replay-silent.mp4 \
  --timeline-frame submission/video/chrome-replay-timeline.png \
  --outro-frame submission/video/chrome-replay-outro.png \
  --output submission/video/chrome-replay-receipt.json
```

4. Assemble the replay and narration. The assembler normalizes any Chrome timer throttling to the authoritative 175-second narration timeline and runs the exact-file video verifier:

```bash
npm run assemble:demo-video
```

The result is `submission/video/semantic-spatial-webmcp-demo.mp4`. It is a 1920 by 1080 landscape MP4 and must remain below 3:00.

The production screenshot in `submission/screenshots/cloudflare-workers-webmcp.png` is the visual reference for the final tool timeline and evidence-overlay state. The replay receipt must finish with `result: "passed"`; ordinary browsing or repository inspection is not a substitute for WebMCP execution.

## Verify the exact export

To recheck the exact candidate independently, run:

```bash
npm run verify:demo-video -- \
  --video submission/video/semantic-spatial-webmcp-demo.mp4 \
  --output docs/demo-video-verification.json
```

The verifier requires FFmpeg's `ffprobe` and `ffmpeg` commands. It rejects:

- a non-MP4 export;
- duration greater than or equal to 180 seconds;
- resolution below 1920 by 1080;
- a missing audio stream;
- invalid audio metadata; or
- an effectively silent audio track.

The passing receipt records the duration, codecs, resolution, frame rate, audio level, byte size, and SHA-256 of the exact MP4. Watch the full export with sound after the automated check; a machine receipt cannot prove intelligible narration or correct visual timing.

## Publish

1. Review `docs/third-party-provenance.md` and confirm the voice and every visible element are owned or licensed.
2. Use the title, description, and settings in `submission/youtube-upload.md` and upload the verified file to YouTube as **Public**.
3. Upload `submission/demo-narration.srt` as the English captions track.
4. Open the YouTube URL while signed out and confirm that it plays with audio and captions.
5. Add the URL to `submission/submission-copy.md` and the Devpost entry.
6. Preserve the public URL and `docs/demo-video-verification.json` through judging.
