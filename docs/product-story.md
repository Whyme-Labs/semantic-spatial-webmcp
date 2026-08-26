# Product story: semantic spatial browser

## The observation

3D Gaussian Splatting makes captured spaces visually convincing, but most scenes remain semantically opaque.

A person can move the camera through a scene. The software still may not know that a cluster of Gaussians is a sofa, that the sofa belongs to a living room, that a doorway connects the room to a corridor, or that one lift is unavailable.

The current fallback is to render a screenshot and ask a vision model what it sees. That provides a temporary interpretation of one view. It does not provide persistent object identity, room membership, global coordinates, hidden context, connectivity, confidence, or history.

The result resembles a webpage with pixels but no DOM.

## The product thesis

**3DGS makes a place visible. We make it understandable, trustworthy, and operable.**

The product is a semantic browser and control plane for captured physical spaces. It turns a 3DGS scene into a structured environment that humans and agents can search, navigate, inspect, verify, and change together.

The primary experience is semantic explorability. Capture assurance and semantic manipulation support it.

```text
Understandability × trust × actionability = useful spatial scene

Semantic exploration × capture assurance × manipulation
```

A weak value in any factor limits the whole experience.

## The missing abstraction: a spatial DOM

The spatial DOM gives stable identities to the elements of a place.

```text
Site
└── Building
    └── Floor
        └── Room or zone
            ├── Objects
            ├── Surfaces
            ├── Portals
            └── Spatial relationships
```

Each entity may contain:

- A stable ID and human-readable label
- Category, aliases, and open-vocabulary tags
- Position, orientation, dimensions, and bounds
- Room, floor, and parent membership
- Relationships such as inside, beside, above, attached to, and connected to
- Affordances such as sittable, movable, openable, or accessible
- The Gaussian group and metric-geometry references
- Best source views and evidence provenance
- Visual, geometric, semantic, and freshness confidence
- Operational and scenario state
- Version history

The agent reasons over rooms, objects, surfaces, paths, and confidence. It does not reason over millions of anonymous Gaussians.

## The three product capabilities

### Semantic exploration

The scene can answer and act on requests such as:

- "Take me to the living room."
- "Show every chair beside a table."
- "Which rooms have ceiling fans?"
- "Find the accessible gate nearest Entrance A."
- "What is behind this sofa?"
- "Create a tour through every public facility on the route."

The agent receives the current camera position, selected object, current room, visible entities, nearby hidden entities, and connected spaces directly from the page.

### Capture assurance

The system assesses whether the evidence is sufficient for the intended task, not whether a generic reconstruction score is high.

For example:

```text
General exploration readiness: 94%
Accessible-wayfinding readiness: 71%

Blocking evidence gaps:
- The alternate corridor sign is unreadable.
- The doorway has weak metric geometry.
- The far end of the corridor was observed from one angle only.
```

The system highlights weak regions, explains the missing evidence, and recommends concrete recapture viewpoints.

### Semantic manipulation

The user manipulates named entities and states rather than raw Gaussian primitives.

- Hide or isolate an object
- Mark a lift unavailable
- Activate a temporary barrier
- Move a cleanly segmented object
- Insert a geometry proxy
- Compare alternative scenarios
- Undo changes
- Commit an approved scene version

Geometry, navigation, and downstream relationships update when the scenario changes.

## Representation stack

3DGS remains one part of the system.

| Layer | Responsibility |
|---|---|
| 3DGS | Photorealistic appearance and exploration |
| LiDAR, point cloud, mesh, or SDF | Measurement, collision, and surfaces |
| Spatial DOM | Rooms, objects, portals, relationships, identity |
| Navigation graph or navmesh | Reachability and route planning |
| Evidence index | Source views, sensor frames, provenance |
| Quality model | Coverage, uncertainty, task readiness |
| Scenario state | Reversible object and operational changes |
| Workflow state | Annotations, issues, approvals, and exports |
| WebMCP | Typed agent access to the live page and shared state |

The system renders with splats, measures with trusted geometry, searches through the scene graph, routes through the navigation layer, and explains conclusions through evidence.

## Initial user

The challenge demonstration targets a visitor exploring a complex transit station. The commercial architecture also fits facilities, construction, property, heritage, insurance, and robotics.

The first challenge user has a concrete job:

> Navigate an unfamiliar multi-level station under accessibility constraints, understand the facilities and decision points, and adapt when the environment changes.

## Demonstration story

The user opens a two-level MRT-style station and asks:

> "I use a wheelchair. Take me from Entrance A to Platform 2 and explain each decision point."

The agent:

1. Reads the current scene, floor, camera, and selection.
2. Finds Entrance A, accessible gates, lifts, platform access, and relevant facilities.
3. Excludes stairs and escalators.
4. Computes a valid route through the room and portal graph.
5. Moves the shared viewer through semantic decision points.
6. Highlights the gate, lift, signs, help points, and destination.
7. Creates a persistent route overlay.

The user follows with:

> "Lift 1 is unavailable and the east corridor is blocked. Find another route."

The agent stages those state changes, recalculates through Lift 2, and shows why the first route no longer works.

The alternate route crosses a region with weak capture evidence. The system reports:

> "The route graph confirms connectivity, but the directional sign at the far end is not visually verified. The current capture has one low-resolution observation."

It highlights the uncertainty, retrieves the best evidence, and recommends a recapture position.

One workflow now demonstrates the complete product:

- Understand the place
- Operate over named entities
- Adapt the place as a scenario
- Expose evidence quality rather than hallucinating certainty
- Keep the human in control of state changes

## Why WebMCP matters

A backend agent can query a database, but it does not automatically share the user's current camera, visible objects, selection, overlays, uncommitted scenario, or review state.

WebMCP lets the page expose narrow tools over this live context. The human and agent work in the same spatial workspace. Every action becomes visible and reversible.

The strongest interaction is not "rotate the camera." It is:

> "Understand where I am, find what matters, show the evidence, and stage the next spatial action."

## Product boundaries for the first release

Fully working:

- Floor, room, and zone hierarchy
- Stable entity identities
- Open-vocabulary search over a verified scene sidecar
- Entity details and relations
- Best-view navigation
- Accessible route planning
- Operational state changes
- Reversible scenarios
- Capture-confidence overlays
- Recapture recommendations
- WebMCP tool registration

Constrained on purpose:

- Semi-automatic semantic preprocessing with human verification
- Known demo-scene relationships and route graph
- A small set of cleanly segmented manipulable objects
- Task-specific capture rules

Not required for the challenge:

- General real-time segmentation of arbitrary scenes
- Arbitrary Gaussian deformation
- Perfect inpainting after object removal
- Safety certification
- Fully autonomous decisions
- A new renderer

## Business expansion

The same semantic spatial core supports different task layers.

| Market | Main job |
|---|---|
| Facilities | Find assets, plan access, inspect evidence, stage work |
| Construction | Navigate zones, inspect installation state, track closeout |
| Property | Search rooms and features, compare layouts, plan changes |
| Heritage | Explore objects and spaces, preserve evidence, compare captures |
| Insurance | Inventory objects by room and attach spatial evidence |
| Tourism and museums | Generate adaptive tours through semantic content |
| Robotics | Supply persistent world memory, affordances, and task grounding |

The early moat is not the renderer. It is the task-aware capture model, cross-view identity, spatial graph corrections, evidence provenance, scenario history, and vertical workflow data.

## Product statement

> Turn spatial captures into environments that people and agents can understand, verify, and change.

A shorter version:

> Search a place. Understand it. Test what happens when it changes.
