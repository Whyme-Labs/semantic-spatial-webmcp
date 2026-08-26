# Architecture

## System boundary

```text
3DGS renderer
    ↕ SpatialViewerAdapter
Semantic spatial runtime
    ├── Entity and region store
    ├── Relationship index
    ├── Route planner
    ├── Capture-quality model
    ├── Evidence index
    └── Reversible scenario state
    ↕
WebMCP tool registry
    ↕
Human and agent in the same page
```

The semantic runtime does not own rendering. It exposes deterministic operations and asks the viewer adapter to visualize their results.

## Entity model

An entity is a stable addressable element such as a lift, gate, chair, table, fan, sign, wall, or doorway.

```js
{
  id: "lift_1",
  type: "lift",
  label: "Lift 1",
  aliases: ["main lift", "east lift"],
  regionId: "vertical_core_east",
  position: [42, 18, 0],
  bounds: { min: [40, 16, 0], max: [44, 20, 3] },
  tags: ["accessible", "vertical-circulation"],
  state: { operational: "open" },
  confidence: {
    category: 0.99,
    boundary: 0.91,
    geometry: 0.96,
    coverage: 0.94,
    freshness: 0.98
  },
  bestViews: ["view_lift1_front"]
}
```

## Region model

Regions form a hierarchy and carry capture quality.

```text
station
├── concourse_floor
│   ├── entrance_a_zone
│   ├── ticketing_zone
│   ├── east_corridor
│   └── west_corridor
└── platform_floor
    └── platform_2_zone
```

## Relationship index

Relationships are explicit and inspectable.

```js
{
  subjectId: "accessible_gate_1",
  predicate: "inside",
  objectId: "ticketing_zone",
  confidence: 1
}
```

Geometry should derive deterministic relations such as distance, containment, adjacency, visibility, and reachability. A model may propose semantic relations, but the system stores confidence and evidence.

## Navigation

The route graph is independent of rendering. Each edge can carry:

- Distance
- Accessibility
- Mode such as walk, lift, escalator, or stairs
- Operational entity dependency
- Blocking entity dependency
- Region ID for capture-confidence warnings

Dijkstra's algorithm selects the lowest-cost valid route after state constraints are applied.

## Capture quality

Quality is a vector rather than one opaque score.

```js
{
  regionId: "west_corridor_far",
  readiness: {
    generalExploration: 0.78,
    accessibleWayfinding: 0.56
  },
  dimensions: {
    coverage: 0.62,
    visual: 0.55,
    geometry: 0.88,
    semantics: 0.71,
    freshness: 0.98
  },
  gaps: [
    {
      id: "gap_west_sign",
      kind: "unreadable_label",
      entityId: "sign_west_platform",
      explanation: "The sign has one oblique, low-resolution observation."
    }
  ]
}
```

A route can be geometrically valid while carrying an evidence warning. The product must preserve that distinction.

## Scenario state

State-changing tools write to a reversible scenario layer first.

```text
Base scene state
    + staged scenario patches
    = effective scene state
```

Examples:

- Lift 1 operational → closed
- Temporary barrier inactive → active
- Chair transform A → transform B

Undo removes the latest patch. Commit can later create a named scene version.

## WebMCP boundary

Each tool is narrow and typed. It returns compact structured output.

Read-only tools:

- `get_scene_context`
- `search_entities`
- `get_entity`
- `find_semantic_route`
- `get_region_quality`

State-changing tools:

- `set_entity_state`
- `undo_scene_change`

The browser runtime remains available without WebMCP so the same operations can be tested deterministically.

## Production storage

A portable scene bundle can use:

```text
scene/
  manifest.json
  appearance/scene.spz
  geometry/scene.laz
  geometry/collision.glb
  semantics/entities.json
  semantics/relations.json
  semantics/instances.bin
  navigation/graph.json
  quality/regions.json
  evidence/views.json
  versions/manifest.json
```

The WebMCP page loads only the subsets needed for the current scene and task.
