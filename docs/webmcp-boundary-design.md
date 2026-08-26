# WebMCP boundary design

## Problem

The current app calls `registerTool()` before the renderer is ready and reports success before any registration Promise settles. WebMCP calls bypass the visible timeline, ignore cancellation, return an MCP-server response wrapper, expose private route-node IDs, and rely on schemas that the local runtime does not enforce.

The fix must preserve the existing store, route planner, viewer adapter, human controls, and dependency-free runtime.

## Usage

Human controls and WebMCP callbacks call one runtime method:

```js
await runtime.invoke("find_semantic_route", {
  from: "Entrance A",
  to: "Platform 2",
  accessibleOnly: true
}, {
  source: "human",
  signal
});
```

The WebMCP callback changes only the source and supplies the browser's signal:

```js
execute: (input, { signal }) => runtime.invoke(tool.name, input ?? {}, {
  source: "agent",
  signal
})
```

The page observes the same runtime for both callers:

```js
const unsubscribe = runtime.observe((event) => renderTimelineEvent(event));
```

## Shape

`SpatialToolRuntime` remains the application API. Its public operations are:

```text
listTools()
invoke(name, input, { source, signal })
observe(listener)
```

The runtime owns these rules:

- Validate every input before a store or viewer effect.
- Emit one start event and one terminal event for every call.
- Pass the `AbortSignal` to viewer operations.
- Return plain JSON values and reject failures.
- Project each tool result to the fields the next tool or agent needs.
- Reject results above an internal 1,450-character limit.
- Resolve route endpoints from public labels, aliases, entity IDs, or region IDs. Keep `n_*` graph IDs private.

`webmcp-adapter.js` owns the browser contract:

- Wait for the page's UI and active renderer or map fallback.
- Preflight names, descriptions, schemas, and standardized annotations before registration.
- Register the complete catalog with one shared registration `AbortController`.
- Await every `registerTool()` Promise.
- Abort the shared registration lifetime and await settlement if any registration fails.
- Report active status only after the complete set succeeds.
- Return raw runtime values from `execute()` and allow errors to reject.
- Expose `dispose()` by aborting the registration lifetime.

The tool set remains static after readiness. Chrome recommends static registration as the default for most apps. The project does not need state-dependent registration to prove the judged flow.

## Tool changes

- Add `reset_scene` so the UI, local console, and agent use one reset path.
- Remove `recommend_recapture` as a separate tool. `get_region_quality` already owns gaps and recapture guidance.
- Keep ten non-overlapping tools.
- Make route input descriptions human-facing. Examples use `Entrance A` and `Platform 2`.
- Mark every viewer-changing tool as not read-only. Keep `get_scene_context` and `get_entity` read-only.
- Remove `destructiveHint` and `idempotentHint`. The current WebMCP draft standardizes only `readOnlyHint` and `untrustedContentHint`.

## Synthesis decision

Candidate A is the base because it models registration as a lifecycle and uses one shared registration signal for rollback. Candidate C contributes the lower-churn implementation shape: keep `SpatialToolRuntime`, add a small listener set, resolve route labels and aliases, and use explicit compact result projections.

The cross-judge scored Candidate A higher on conformance, lifecycle integrity, cancellation, information hiding, and testability. Candidate C scored higher on proportionality. The merged design keeps A's guarantees without A's proposed `startSpatialApp()` wrapper or extra service types.

Rejected choices:

- Sequential registration that leaves earlier tools active after a later failure.
- MCP-server result envelopes such as `content`, `structuredContent`, or `isError`.
- A command bus, event store, plugin framework, or dependency-injection container.
- Generic string slicing to satisfy output limits.
- Public `n_*` navigation-node IDs.
- Direct UI reset mutations outside the tool runtime.

## Tradeoffs

- We accept more policy inside `SpatialToolRuntime` in exchange for one execution contract for every caller.
- We accept compensating registration rollback instead of claiming browser-level transactionality.
- We accept rejecting oversized results in tests and development instead of returning incomplete JSON.
- We accept static registration in exchange for a smaller and more reliable challenge build.
- We keep the timeline in memory because persistence adds no value to the judged flow.

## Risks

- A tool may be briefly visible before registration rollback completes. The page must never report partial registration as active.
- Cancellation can race with a synchronous state commit. State tools must check the signal before the commit point.
- A viewer failure after a state commit needs compensation by the exact change ID. Generic undo-latest is unsafe if calls overlap.
- Labels or aliases can map to more than one route anchor. Ambiguous references must reject with compact alternatives.
- The 1,450-character limit is a character budget. Tests must also track UTF-8 bytes if non-ASCII scene labels are introduced.

## Verification contract

Implementation is complete only when tests prove these behaviors:

1. No registration starts before page readiness.
2. Success resolves only after all registration Promises resolve.
3. One registration rejection removes the whole set and never reports active status.
4. Unsupported WebMCP leaves the human interface active.
5. WebMCP execution returns plain JSON.
6. Execution failures reject and appear once in the timeline.
7. Cancellation reaches and stops camera navigation when the browser supplies an execution signal. Record clients that omit the execution context.
8. Human and agent calls produce the same result and visual effect with different source labels.
9. Runtime validation rejects extra fields, wrong types, invalid ranges, and unsupported state patches.
10. Every result stays below the output budget.
11. Route calls accept public labels and expose no private graph IDs.
12. Chrome with WebMCP testing enabled discovers and executes the full tool set.
