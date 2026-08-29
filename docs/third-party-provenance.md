# Third-party provenance

This inventory records every third-party component or asset used by the checked-in application and planned submission media.

## Runtime code

| Component | Version | Use | Source | License | Distribution |
|---|---:|---|---|---|---|
| Spark | 2.1.0 | Gaussian-splat loading and rendering | [sparkjsdev/spark](https://github.com/sparkjsdev/spark) | [MIT](https://github.com/sparkjsdev/spark/blob/main/LICENSE) | Loaded from Spark's pinned public release URL. Not copied into this repository. |
| Three.js | 0.180.0 | Camera, controls, meshes, labels, and overlays | [mrdoob/three.js](https://github.com/mrdoob/three.js) | [MIT](https://github.com/mrdoob/three.js/blob/r180/LICENSE) | Loaded from jsDelivr with an exact version. Not copied into this repository. |

`index.html` pins both versions. The application does not request a moving `latest` tag.

## Scene data

The default Harbour Junction Station is generated at runtime by `SplatStationViewer.constructStationSplats()`. The generator, semantic sidecar, route graph, quality records, and entity proxies are part of this repository. No captured station asset is included.

The optional `splat` query parameter can load a third-party file for local testing. The operator must have permission to use and publish that file. An arbitrary file does not become part of the submission and does not inherit this repository's MIT license.

Spark's public `butterfly.spz` sample was used only for a local loader check. The file is not stored in this repository, the screenshots are ignored, and the sample must not appear in the final submission media without written permission from its owner.

## Fonts, icons, marks, and media

- The interface uses the operating system's font stack. No font files are bundled.
- The SceneIndex mark and source brand board were supplied and approved by the entrant. The production SVGs, fit evidence, palette rules, and motion study are recorded under `assets/brand/` and `docs/brand/`.
- No icon set, third-party music, stock footage, photographs, or third-party trademarks are included.
- Local Playwright screenshots under `output/playwright/` are ignored. They are engineering receipts, not submission media.
- `submission/screenshots/chrome-webmcp-flow.png` is an automated capture of this project's synthetic interface. `context-comparison.svg`, its PNG export, and `demo-dynamic-contact-sheet.png` are project-authored SceneIndex evidence. None contains a captured station asset or third-party media.
- Final screenshots and video must show only the project interface, the approved browser controls, and materials owned or licensed by the entrant.

## Narration production

| Component | Version | Use | Source | License | Distribution |
|---|---:|---|---|---|---|
| VoxCPM2 | upstream `bffb3df`, GGUF conversion `169f64d` | Local voice-cloned English narration | [OpenBMB/VoxCPM](https://github.com/OpenBMB/VoxCPM), [VoxCPM2-GGUF](https://huggingface.co/DennisHuang648/VoxCPM2-GGUF) | Apache-2.0 | Model weights remain in local caches and are not copied into this repository. |
| llama.cpp-omni | upstream `64d092c` plus `patches/voxcpm2-long-form-graph.patch` | One-pass VoxCPM2 inference and voice cloning on CPU or Metal | [tc-mb/llama.cpp-omni](https://github.com/tc-mb/llama.cpp-omni) | MIT | Built in a dedicated local cache. The small local graph-capacity patch and final binary SHA-256 are recorded; source, binary, and weights are not copied into this repository. |

The entrant supplied and authorized the voice reference identified in `docs/entrant-attestation.json`. The source recording is not committed or distributed. VoxCPM2 generates the complete 247-word performance in one inference. The accepted take then receives deterministic full-track spectral cleanup; no speech is regenerated, replaced, or stitched. It passes transcript alignment, per-word pronunciation confidence, silence analysis, the measured hum-band limits, and an inter-beat background-vocal gate before it is muxed into the final MP4.

The editor adds project-authored synthesized UI ticks and an original ambient score generated deterministically by `scripts/build-dynamic-demo-video.mjs`. The twelve chord beds follow the story beats, use no samples or external recordings, and duck beneath the narration. The score is local build output; its generator settings and SHA-256 are recorded in `docs/demo-video-verification.json`.

## Final media review

Before publication, the entrant must confirm these statements:

- Every visible name, logo, image, voice, person, and music track is owned or licensed for public use.
- The public repository host recognizes the root MIT license.
- The live app loads the exact Spark and Three.js versions listed above.
- The final video does not show private tabs, account details, notifications, or unrelated copyrighted content.
