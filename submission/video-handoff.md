# Demo video handoff

The public app, Chrome WebMCP flow, narration, prompts, and shot timings are ready. The final recording remains intentionally outside the repository because it must use the entrant's approved voice and YouTube account.

## Record

1. Use the production app at https://semantic-spatial-webmcp.swmengappdev.workers.dev/.
2. Open a fresh ChatGPT conversation with GPT-5.6 Sol or GPT-5.6 Terra and confirm that all ten Site Tools are available.
3. Hide private tabs, notifications, bookmarks, account details, and unrelated marks.
4. Record the three prompts and shot sequence in `submission/demo-script.md` with clear English narration and no music.
5. Export a landscape MP4 at 1920 by 1080 or higher. Aim for 2:45 to 2:55 and never reach 3:00.

The production screenshot in `submission/screenshots/cloudflare-workers-webmcp.png` is the visual reference for the final tool timeline and evidence-overlay state.

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
