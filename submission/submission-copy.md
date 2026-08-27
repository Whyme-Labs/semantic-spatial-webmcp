# SceneIndex

## Short description

SceneIndex turns a Gaussian-splat scene into a place that people and agents can search, inspect, route through, test, and verify together.

## Tagline

Search a place. Understand it. Test what happens when it changes.

## Project description

A photorealistic 3D capture shows what a place looks like, but it does not tell an agent where the accessible gate is, which lift connects to the platform, whether an obstacle blocks a route, or whether the available visual evidence is good enough to trust.

SceneIndex adds that missing layer. The demo models a two-level transit station with persistent entities, regions, relationships, route constraints, capture-quality records, and reversible scenario state. A person can inspect the Gaussian-splat scene while an agent uses page-provided WebMCP tools to search it, move the live camera, calculate an accessible route, close a lift, find the alternate route, identify weak capture evidence, recommend a recapture position, and undo the change.

The checked-in station is a deterministic synthetic Gaussian-splat fixture. It demonstrates the complete product and WebMCP behavior without claiming that generated data is a captured site. The renderer also accepts licensed, spatially registered splat files.

## Why WebMCP

This work depends on the state of the page that the person is viewing. The useful context includes the camera pose, selected entity, visible objects, active overlays, route, and staged scene changes. A backend tool that cannot see that state would force the person and the agent into separate workspaces.

WebMCP lets the page expose narrow tools over the same live scene. The agent can act through stable entity and region IDs, and the person sees each result in the 3D view. The ordinary interface remains available when WebMCP is unsupported.

## User experience

The judged path starts with one clear job: find an accessible route from Entrance A to Platform 2.

The first route uses Lift 1. The person then closes Lift 1 as a reversible scenario change. The next route uses Lift 2 and reports that the West corridor has only 56 percent accessible-wayfinding readiness. The page highlights the weak region and sign, retrieves the named best evidence view, explains the unreadable sign and single-view coverage gap, and renders two concrete recapture positions as 3D markers. The person can inspect the evidence, undo the outage, or reset the scene.

The same actions work through visible controls and site tools. Camera motion, highlights, routes, evidence volumes, state changes, and the call timeline stay synchronized.

## People and agents

People decide the goal, inspect the spatial evidence, and approve operational conclusions. Agents handle search, graph traversal, comparison, sequencing, and structured evidence retrieval.

Before this interface, an agent would have to infer spatial meaning from screenshots or drive a viewer through fragile click coordinates. The page now supplies explicit objects, places, relations, route anchors, state, and confidence. The agent can answer a spatial question and show the exact scene change that supports the answer.

## How WebMCP was implemented

The app registers ten imperative site tools through `document.modelContext.registerTool()`. Each tool reuses the same `SpatialToolRuntime` that powers the human controls. Tool inputs use JSON Schema, the runtime validates the same inputs again, and the viewer adapter applies visible effects to both the Spark and Three.js scene and the 2D fallback map.

The registration boundary waits for the active renderer or fallback, awaits every browser registration, reports registration failures, returns compact JSON, and uses only standardized WebMCP annotations. Human and agent calls enter one observable invocation path. The runtime accepts cancellation signals when the browser supplies them.

## WebMCP Leverage

- The tools read the current camera, region, selection, visibility, and scenario history.
- Agent actions update the live page instead of an invisible backend copy.
- The evidence package contrasts a one-frame screenshot with the persistent identity, hidden connectivity, live state, and confidence available through the page.
- Search, navigation, routing, state changes, capture assurance, undo, and reset are separate typed operations.
- State-changing actions are staged and reversible.
- The page preserves a complete human interface when site tools are unavailable.

## Execution

- The default scene loads without an account or private service.
- Route planning changes deterministically when a lift closes or a barrier activates.
- The 3D renderer, 2D fallback, semantic runtime, and site tools share one state model.
- Automated tests cover route logic, scenario state, coordinate mapping, renderer adaptation, registration, validation, output budgets, and submission gates.
- The repository includes a deterministic production builder, security headers, hashes, and browser verification instructions.

## Potential Impact

The first audience is operators and inspectors who work with captured buildings, transit spaces, and other complex facilities. The same pattern supports accessible wayfinding, handover inspection, maintenance planning, remote review, and recapture decisions.

The product does not ask an agent to trust appearance alone. It exposes the geometry, semantic identities, operational state, and evidence confidence needed to make a bounded decision.

## Creativity & Ambition

The central idea is a spatial document object model. Gaussian splats provide appearance. A semantic graph supplies persistent meaning. Quality records expose where the capture is weak. Reversible scenario state lets the person and agent test what happens when the place changes.

WebMCP is the control interface over that combined representation. The result is a shared spatial workspace rather than a chat box attached to a 3D viewer.

## Challenge-period work

The repository preserves `starter-v0.1.0` and its SHA as the first semantic vertical slice. Later challenge work adds the Spark renderer, generated Gaussian station, semantic proxy binding, camera control, 3D route and quality overlays, browser adapter, WebMCP conformance work, verification gates, deployment artifact, and submission package. `CHALLENGE_DELTA.md` distinguishes this work from third-party libraries and any future captured asset.

## Technical stack

- Browser ES modules and the WebMCP imperative API
- Spark 2.1.0 and Three.js 0.180.0
- A dependency-free semantic store and route planner
- Node's built-in test runner
- Cloudflare Workers Static Assets with origin isolation and a `tools=(self)` permissions policy

## Links

- Public source: https://github.com/Whyme-Labs/semantic-spatial-webmcp
- Live application: https://semantic-spatial-webmcp.swmengappdev.workers.dev/
- Public demo video: pending owner upload of the verified 158-second story-driven MP4
