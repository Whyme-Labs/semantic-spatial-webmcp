# Viewer integration

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

The real viewer integration is complete when:

1. `search_entities` finds an entity in the sidecar.
2. `navigate_to_entity` moves the real 3DGS camera to its best view.
3. `find_semantic_route` draws a route overlay in the scene.
4. Closing Lift 1 removes it from the route graph and changes the overlay.
5. `get_region_quality` highlights a weak corridor region.
6. Reset restores the initial scene without reload.
