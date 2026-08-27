# Demo video handoff

The upload candidate is a 24-shot edit built from the verified public Chrome replay and one continuous VoxCPM2 narration. The final MP4 and authorized source voice stay outside Git under ignored `submission/video/`; checked-in receipts bind their exact hashes.

## Generate the full narration

The local GGUF engine needs the checked-in graph-capacity patch for a 406-word cloned-voice prompt:

```bash
git -C <voxcpm2-llama.cpp-omni-root> apply --unidiff-zero "$PWD/patches/voxcpm2-long-form-graph.patch"
cmake --build <voxcpm2-llama.cpp-omni-root>/build --target voxcpm2-cli -j 8
```

Generate the entire performance in one inference. Seed 42 produced a rejected mid-track vocal artifact; seed 43 is the verified take.

```bash
npm run generate:demo-narration -- \
  --reference-audio <owner-authorized-voice-sample.m4a> \
  --backend gguf \
  --seed 43

npm run verify:demo-narration
npm run verify:demo-audio
```

The accepted master must satisfy all of these:

- `generator.mode` is `single-pass`;
- 12 of 12 story beats align with no failures;
- total silence stays below 12 percent;
- the longest silent gap stays below two seconds; and
- the measured 330–346 Hz tone stays at or below the surrounding-spectrum limit.

## Capture the real WebMCP flow

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

The replay must expose ten tools, execute ten successful agent-labelled calls, finish with zero console errors, and point to the clean deployed artifact.

## Build the dynamic edit

```bash
npm run assemble:demo-video
npm run verify:media-dynamics
```

The editor reads the forced-alignment receipt and places cuts only between speech beats. It creates 24 shots with live-scene crops, evidence close-ups, timeline pans, a context-comparison beat, and a branded resolution. The final dynamics gate requires at least eight detected cuts and rejects freeze events longer than eight seconds.

## Verify the exact export

```bash
npm run verify:demo-video -- \
  --video submission/video/semantic-spatial-webmcp-demo.mp4 \
  --output <independent-receipt.json>
```

Do not overwrite `docs/demo-video-verification.json` with the basic verifier output. The dynamic editor writes the full source, narration, timing, shot, and motion receipt there.

The final file must remain below three minutes, at least 1920 by 1080, audible, and free of unlicensed media. Watch it from beginning to end with sound before upload.

## Publish

1. Upload `submission/video/semantic-spatial-webmcp-demo.mp4` to YouTube as Public.
2. Upload `submission/demo-narration.srt` as the English captions track.
3. Use `submission/youtube-upload.md` for title, description, and settings.
4. Check the processed video while signed out before adding its URL to Devpost.
