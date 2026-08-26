# Semantic spatial WebMCP starter

This repository is the first working vertical slice of a semantic spatial browser for 3D Gaussian Splatting scenes.

The visual scene remains in the existing 3DGS viewer. This package adds the missing control plane:

- Stable rooms, zones, objects, surfaces, and portals
- Semantic search and relationship queries
- Accessible route planning over a spatial graph
- Per-region capture confidence and recapture recommendations
- Reversible scene scenarios such as closing a lift or activating a barrier
- Typed WebMCP tools bound to the same live page state
- A viewer adapter that can be connected to PlayCanvas, SuperSplat, Three.js, Spark, or a custom renderer

The included browser demo uses a simple station map so the semantic logic can be tested without a particular splat renderer.

## Run

```bash
npm test
npm run serve
```

Open `http://localhost:4173`.

No package installation is required. The implementation uses browser ES modules and Node's built-in test runner.

## Demo flow

1. Click **Accessible route**. The route uses Lift 1.
2. Click **Close Lift 1**.
3. Run the route again. It moves to Lift 2 and warns that part of the alternate corridor has weak capture evidence.
4. Click **Show capture gaps** to inspect the weak region and its recommended recapture viewpoints.
5. Search for `bench`, `help point`, `accessible gate`, or `lift`.
6. Open the tool console and invoke any registered semantic tool directly.

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
- `recommend_recapture`
- `list_uncertain_entities`

## Connect a 3DGS viewer

Implement the `SpatialViewerAdapter` contract in `src/viewer-adapter.js`:

```js
const adapter = {
  getContext: async () => ({
    cameraPose: viewer.getCameraPose(),
    currentRegionId: spatialIndex.lookupRegion(viewer.getCameraPosition()),
    selectedEntityId: selection.currentEntityId,
    visibleEntityIds: visibility.getVisibleEntityIds()
  }),

  navigateToEntity: async (entity, options) => {
    await viewer.flyTo(entity.bestView.pose, options);
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

  onScenarioChanged: async (changes) => {
    semanticOverlay.applyScenario(changes);
  }
};
```

Then construct the tool runtime with that adapter and call `registerWebMCPTools`.

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
- `CHALLENGE_DELTA.md`
