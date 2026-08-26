# Viewer integration

## Current status

The browser now has a working Spark and Three.js renderer bridge in `src/splat-station-viewer.js`.

Verified on August 26, 2026:

- The default station fixture renders as 12,026 Gaussian splats.
- Semantic proxies can be selected and highlighted in the 3D scene.
- `navigate_to_entity` resolves the entity's named evidence-view pose, reports that exact view ID, and animates the Three.js camera; a derived pose is used only when evidence has no pose.
- `get_scene_context` returns the live camera pose, camera-position region, selected entity, and visible entity IDs.
- Routes render in 3D and change from Lift 1 to Lift 2 after an outage.
- Capture quality renders as a volume around the weak corridor.
- Entity state changes update 3D proxy color and visibility.
- The 2D map remains usable as a fallback.
- A remote `.spz` file loads and renders through the same path.

The checked-in station appearance is synthetic. A licensed captured station asset with a verified registration transform is still required before calling the challenge scene a captured 3DGS station.

## Goal

Connect the semantic runtime to the existing 3DGS viewer without coupling scene reasoning to a renderer.

## Required adapter methods

```js
/** @typedef {import('../src/types.js').SpatialViewerAdapter} SpatialViewerAdapter */
```

The adapter must support:

- Reading current camera, region, selection, and visible entity IDs
- Navigating to an entity's best view
- Highlighting one or more entities
- Drawing or clearing a route
- Showing a capture-quality overlay
- Reacting to scenario changes

## Binding semantic entities to Gaussians

Use one of these strategies.

### Compact per-Gaussian instance IDs

Store one integer instance ID per Gaussian in an aligned binary sidecar. This is compact and supports precise highlighting when splat order is stable.

### Gaussian index ranges

Store compressed ranges of Gaussian indices per entity. This is simple for static assets but breaks if the splat file is reordered.

### Spatial proxies

Use oriented bounds, convex hulls, or low-resolution meshes when exact Gaussian membership is unavailable. This is enough for navigation, selection, and early demos.

### Runtime picking

Map the picked Gaussian or depth hit back to an entity ID through the instance sidecar.

For the challenge, start with spatial proxies and verified best-view poses. Add exact Gaussian grouping after the full WebMCP path works.

## Camera navigation

Each entity should provide one or more ranked views:

```js
{
  id: "view_lift1_front",
  entityId: "lift_1",
  pose: {
    position: [38, 18, 1.6],
    target: [42, 18, 1.5]
  },
  visibility: 0.94,
  imageQuality: 0.91,
  purpose: ["identification", "navigation"]
}
```

The adapter interpolates the live camera to the selected pose. Avoid hard camera cuts in the judged flow.

## Context synchronization

Update the semantic runtime when:

- The camera enters a new region
- The user selects an entity
- Visibility changes materially
- A scenario patch changes route validity
- A quality overlay opens or closes

Do not serialize the entire scene into every tool result. Return current context and IDs, then let the agent request entity details as needed.

## First integration milestone

The renderer milestone is complete when:

1. `search_entities` finds an entity in the sidecar.
2. `navigate_to_entity` moves the real 3DGS camera to its best view.
3. `find_semantic_route` draws a route overlay in the scene.
4. Closing Lift 1 removes it from the route graph and changes the overlay.
5. `get_region_quality` highlights a weak corridor region.
6. Reset restores the initial scene without reload.

All six operations now work against the Spark scene. The captured-data milestone is separate:

1. Add a licensed, compressed station asset.
2. Store its world registration in the scene manifest.
3. Verify 15 to 30 semantic proxy bounds against the capture.
4. Replace fallback camera poses with evidence-backed best-view poses.
5. Record asset provenance, size, hash, and public serving URL.

## Loading an external appearance

For a renderer smoke test, pass a CORS-accessible asset URL:

```text
http://localhost:4173/?splat=https%3A%2F%2Fexample.com%2Fstation.spz
```

This does not make an arbitrary asset semantically aligned. The asset must share the sidecar coordinate system or supply an `appearanceTransform` when `SplatStationViewer` is constructed.
