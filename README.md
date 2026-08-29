# SceneIndex

SceneIndex is a semantic spatial browser for 3D Gaussian Splatting scenes. This repository contains the working WebMCP challenge vertical slice.

Public source: [Whyme-Labs/semantic-spatial-webmcp](https://github.com/Whyme-Labs/semantic-spatial-webmcp)

Live application: [semantic-spatial-webmcp.swmengappdev.workers.dev](https://semantic-spatial-webmcp.swmengappdev.workers.dev/)

Brand assets, palette rules, vector-fit evidence, and the motion study live in [`docs/brand/brand-guidelines.md`](docs/brand/brand-guidelines.md). The public repository and Worker keep the original technical slug so existing judge links remain stable.

The browser now renders an interactive Gaussian-splat station fixture through [Spark 2.1.0](https://github.com/sparkjsdev/spark) and Three.js 0.180.0. Semantic IDs are bound to lightweight spatial proxies in that scene. The same camera, selection, routes, capture-quality overlays, and reversible state changes are available to the human interface and the WebMCP tools.

The semantic control plane provides:

- Stable rooms, zones, objects, surfaces, and portals
- Semantic search and relationship queries
- Accessible route planning over a spatial graph
- Per-region capture confidence and recapture recommendations
- Reversible scene scenarios such as closing a lift or activating a barrier
- Typed WebMCP tools bound to the same live page state
- A renderer bridge that can also be connected to PlayCanvas, SuperSplat, or a custom renderer

The default appearance is a deterministic synthetic fixture made from 12,026 Gaussian splats. It is not presented as a captured station. A captured and spatially registered station asset remains the next data milestone. The original 2D map stays available as an explicit fallback.

## Run

```bash
npm test
npm run serve
```

Open `http://localhost:4173`.

Running the app and its deterministic tests requires no package installation. Cloudflare deployment uses the pinned Wrangler development dependency, installed with `npm ci`.

The repository verification scripts require Node.js 22 or later. The static app itself has no server-side runtime dependency.

The 3D view needs network access for the pinned Spark and Three.js modules. If they fail to load or WebGL 2 is unavailable, the app switches to the deterministic 2D map.

## Demo flow

For the fastest end-to-end proof, click **Run guided proof**. It runs the same reversible tool sequence exposed to an agent and leaves the scene at its baseline.

1. Orbit the Gaussian-splat station or search for an entity to animate the live camera.
2. Click **Accessible route**. The route uses Lift 1 and renders in the 3D scene.
3. Click **Close Lift 1**.
4. Run the route again. It moves to Lift 2 and warns that part of the alternate corridor has weak capture evidence.
5. Click **Show capture gaps** to render the weak region and inspect its recommended recapture viewpoints.
6. Search for `bench`, `help point`, `accessible gate`, or `lift`.
7. Invoke `get_scene_context` in the tool console to inspect the live 3D camera, selection, region, and visible entity IDs.

When the page runs inside a WebMCP-capable browser, the same tools register through `document.modelContext.registerTool`. Otherwise, the local console remains available for deterministic testing.

## Core tools

- `get_scene_context`
- `search_entities`
- `get_entity`
- `navigate_to_entity`
- `find_semantic_route`
- `set_entity_state`
- `undo_scene_change`
- `get_region_quality`
- `list_uncertain_entities`
- `reset_scene`

## Load a captured splat

Pass a CORS-accessible splat URL with the `splat` query parameter:

```text
http://localhost:4173/?splat=https%3A%2F%2Fexample.com%2Fstation.spz
```

Spark accepts `.ply`, `.spz`, `.splat`, `.ksplat`, `.sog`, `.zip`, and `.rad` inputs. Loading a file proves the renderer path only. A useful semantic scene also needs the appearance asset registered to the station coordinate system and its entity proxies or Gaussian instance IDs verified against the captured content.

`SplatStationViewer` accepts an `appearanceTransform` with position, rotation, and scale when constructing the renderer. Production scene bundles should store that transform and their semantic bindings in a manifest rather than a query string.

## Connect another 3DGS viewer

Implement the renderer bridge consumed by `BrowserSpatialViewerAdapter` in `src/viewer-adapter.js`:

```js
const bridge = {
  getContext: async () => ({
    cameraPose: viewer.getCameraPose(),
    currentRegionId: spatialIndex.lookupRegion(viewer.getCameraPosition()),
    selectedEntityId: selection.currentEntityId,
    visibleEntityIds: visibility.getVisibleEntityIds()
  }),

  navigateToEntity: async (entity, options) => {
    await viewer.flyTo(entity.bestView.pose, options);
    return { selectedViewId: entity.bestView.id };
  },

  highlightEntities: async (ids) => {
    semanticOverlay.highlight(ids);
  },

  setRoute: async (route) => {
    routeOverlay.render(route.polyline);
  },

  showQualityOverlay: async (quality) => {
    qualityOverlay.render(quality);
  },

  syncEntityState: async (entity) => {
    semanticOverlay.applyEntityState(entity);
  }
};
```

Attach the bridge with `viewer.attachBridge(bridge)`. The semantic runtime and WebMCP tool definitions do not change.

## Scene sidecars

The production scene should keep semantic data separate from the splat asset:

```text
scene.spz
scene.semantic.json
scene.instances.bin
scene.routes.json
scene.quality.json
scene.evidence.json
```

`scene.instances.bin` can map each Gaussian index to a compact instance ID. Rich labels, relations, confidence, and evidence live once per entity in `scene.semantic.json`.

## Documents

- `docs/product-story.md`
- `docs/challenge-delivery-plan.md`
- `docs/architecture.md`
- `docs/viewer-integration.md`
- `docs/browser-verification.md`
- `docs/context-comparison.md`
- `docs/public-repository-verification.json`
- `CHALLENGE_DELTA.md`

## Verification

```bash
npm run verify
npm run eval
```

This reruns the syntax check and all deterministic tests, then refreshes `docs/test-results.txt` and `docs/build-verification.json`. Browser verification is recorded separately because a passing Node test cannot prove WebGL rendering or CDN loading.

The prompt-level deterministic evaluation set is in `evals/webmcp-cases.json`. To exercise the exact production artifact in Chrome with `WebMCPTesting` enabled, run `npm run build`, serve `dist/` with `npm run serve:dist`, then run `npm run verify:webmcp:chrome`. The Chrome verifier requires the build manifest and refuses to treat the source server as the publish artifact.

The public repository workflow at `.github/workflows/verify.yml` reruns syntax, all deterministic tests, a Wrangler deployment dry run, baseline-tag verification, and submission gates on Node.js 22. It has read-only repository permissions and fails if verification rewrites tracked evidence.

The demo-media pipeline uses one continuous VoxCPM2 narration and a beat-aligned 24-shot edit:

```bash
npm run generate:demo-narration -- --reference-audio <authorized-sample.m4a> --backend gguf --seed 44 --temperature 0.75
npm run verify:demo-narration
npm run clean:demo-narration
npm run verify:demo-narration
npm run verify:demo-audio
npm run assemble:demo-video
npm run verify:media-dynamics
npm run verify:youtube-upload
```

`submission/video-handoff.md` records the pinned long-form inference patch, source capture command, quality thresholds, and exact-file review steps.

## Deploy

Install the pinned deployment tool and validate the exact Workers upload:

```bash
npm ci
npm run deploy:dry-run
```

Deploy the allowlisted `dist/` artifact as Cloudflare Workers Static Assets:

```bash
npm run deploy
```

`wrangler.jsonc` keeps assets on Cloudflare's direct static path. Cloudflare parses `dist/_headers` and applies the WebMCP headers without invoking Worker code for each asset. Do not send `Origin-Agent-Cluster: ?0`, because that disables WebMCP.

See `deployment/README.md` for the production header checks, clean-browser test, and judge-access requirements.
