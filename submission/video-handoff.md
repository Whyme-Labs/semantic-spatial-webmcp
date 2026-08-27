# Demo video handoff

The public app, Chrome WebMCP flow, narration, prompts, and shot timings are ready. The final recording remains intentionally outside the repository because it must use the entrant's approved voice and YouTube account.

## Record

1. Use the production app at https://semantic-spatial-webmcp.swmengappdev.workers.dev/.
2. Hide private tabs, notifications, bookmarks, account details, and unrelated marks.
3. Start the paced, visible Chrome 151 WebMCP replay below. It uses an isolated profile, waits 20 seconds before the first call, holds each of ten real WebMCP results for 11 seconds, and keeps the final evidence state open for 35 seconds.

```bash
npm run verify:webmcp:chrome -- \
  --url https://semantic-spatial-webmcp.swmengappdev.workers.dev/ \
  --headed \
  --start-delay 20000 \
  --step-delay 11000 \
  --hold 35000 \
  --output submission/video/chrome-replay-receipt.json \
  --screenshot submission/video/chrome-replay-final.png
```

4. Begin screen recording while the initial full-station view is held. Narrate `submission/demo-script.md`; the replay advances through the same verified ten-call flow and ends on the visible agent timeline.
5. Stop recording before the isolated Chrome window closes. Export a landscape MP4 at 1920 by 1080 or higher. Aim for 2:45 to 2:55 and never reach 3:00.

The production screenshot in `submission/screenshots/cloudflare-workers-webmcp.png` is the visual reference for the final tool timeline and evidence-overlay state. The replay receipt must finish with `result: "passed"`; ordinary browsing or repository inspection is not a substitute for WebMCP execution.

## Verify the exact export

Place the candidate outside Git or under ignored `submission/video/`, then run:

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
2. Upload the verified file to YouTube as **Public**.
3. Open the YouTube URL while signed out and confirm that it plays with audio.
4. Add the URL to `submission/submission-copy.md` and the Devpost entry.
5. Preserve the public URL and `docs/demo-video-verification.json` through judging.
