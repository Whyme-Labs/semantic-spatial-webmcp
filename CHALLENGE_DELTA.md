# WebMCP challenge delta

Use this file in the final public repository to distinguish challenge work from any pre-existing 3DGS viewer.

## Baseline

Before merging this package into the viewer repository:

1. Tag the current repository state as `pre-webmcp-challenge`.
2. Record the tag SHA and timestamp here.
3. Keep challenge-specific work in clearly named commits or a dedicated branch.

```text
Baseline tag: starter-v0.1.0
Baseline SHA: 8949b3c2bb0a3bf85b33104279c57301185211c1
Working branch: main in the standalone starter
Recorded: August 26, 2026
```

This tag marks the first semantic vertical slice before the Spark and Three.js viewer integration. A separate baseline tag is still required if this starter is later merged into a pre-existing product repository.

## Baseline capabilities preserved

The following capabilities already existed at `starter-v0.1.0`. They remain part of the final product, but are not claimed as post-baseline challenge work:

- Semantic spatial entity and region model
- Persistent object IDs and relationships
- Scene search engine
- Accessible route planner with operational constraints
- Task-aware capture-quality records
- Recapture recommendation model
- Reversible scenario state
- Viewer adapter contract
- WebMCP tool registry
- Two-level station fixture
- Browser demonstration
- Deterministic tests
- Product and delivery documentation

## Work after `starter-v0.1.0`

- Spark 2.1.0 and Three.js 0.180.0 browser renderer integration
- Deterministic 12,026-splat synthetic station appearance
- Semantic-to-world coordinate mapping
- 3D entity proxy binding and picking
- Animated best-view camera navigation
- 3D route and capture-quality overlays
- Live camera, region, selection, and frustum context
- Captured splat URL loading with synthetic fallback
- Explicit 2D map mode and automatic WebGL fallback
- Renderer-boundary and coordinate tests
- Rerunnable verification receipt generator
- Awaited, all-or-none imperative WebMCP registration
- Runtime input validation, compact JSON output budgets, and standardized annotations
- Public-label route resolution without leaking private navigation-node IDs
- Source-labelled human and agent invocation timeline
- One-click guided judge path with stale-overlay invalidation
- Prompt fixture evaluation suite with explicit model-evidence boundaries
- Repeatable Chrome WebMCP discovery and execution verifier
- Allowlisted production builder, security headers, readiness registry, and submission package
- SceneIndex identity system, production SVG assets, vector-fit evidence, and motion study

The standalone starter had no pre-existing browser renderer to attach to. The challenge work therefore adds the smallest Spark/Three bridge needed to make the semantic runtime visible and testable; it does not claim a new rendering algorithm or replace Spark.

## Existing work not claimed

- Spark is an MIT-licensed external renderer and is not claimed as challenge work.
- Three.js is an MIT-licensed external 3D library and is not claimed as challenge work.
- Any splat loaded through the `splat` query parameter remains owned and licensed by its source. No captured scene asset is included or claimed here.
