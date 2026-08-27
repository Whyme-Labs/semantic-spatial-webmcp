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
- No icon set, music, stock footage, photographs, or third-party trademarks are included.
- Local Playwright screenshots under `output/playwright/` are ignored. They are engineering receipts, not submission media.
- `submission/screenshots/chrome-webmcp-flow.png` is an automated capture of this project's synthetic interface. `context-comparison.svg` and its PNG export are project-authored SceneIndex diagrams. None contains a captured station asset or third-party media.
- Final screenshots and video must show only the project interface, the approved browser controls, and materials owned or licensed by the entrant.

## Narration production

| Component | Version | Use | Source | License | Distribution |
|---|---:|---|---|---|---|
| VoxCPM2 | upstream `bffb3df`, GGUF conversion `169f64d` | Local voice-cloned English narration | [OpenBMB/VoxCPM](https://github.com/OpenBMB/VoxCPM), [VoxCPM2-GGUF](https://huggingface.co/DennisHuang648/VoxCPM2-GGUF) | Apache-2.0 | Model weights remain in local caches and are not copied into this repository. |
| llama.cpp-omni | `64d092c` | Metal-accelerated VoxCPM2 inference and voice cloning | [tc-mb/llama.cpp-omni](https://github.com/tc-mb/llama.cpp-omni) | MIT | Built in a dedicated local cache; source and binary are not copied into this repository. |

The entrant supplied and authorized the voice reference identified in `docs/entrant-attestation.json`. The source recording is not committed or distributed. The generated narration is submission media, contains no music, and is verified separately before it is muxed into the final MP4.

## Final media review

Before publication, the entrant must confirm these statements:

- Every visible name, logo, image, voice, person, and music track is owned or licensed for public use.
- The public repository host recognizes the root MIT license.
- The live app loads the exact Spark and Three.js versions listed above.
- The final video does not show private tabs, account details, notifications, or unrelated copyrighted content.
