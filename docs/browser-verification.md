# Browser verification

Verified locally on August 26, 2026 against `http://127.0.0.1:4173` with Chromium through Playwright CLI.

## Default Gaussian fixture

Observed in a fresh page:

- Spark and Three.js loaded without console errors.
- The deterministic station reported 12,026 Gaussian splats.
- The 3D viewport rendered two station levels, semantic proxy bounds, labels, and orbit controls.
- The 2D map toggle remained usable.

## Complete interaction path

The browser produced these results:

1. `Accessible route` used Lift 1 and rendered the full route in 3D.
2. `Close Lift 1` staged the outage and recolored the Lift 1 proxy.
3. Running the route again used Lift 2.
4. The alternate route reported West corridor at 56 percent accessible-wayfinding readiness.
5. `Show capture gaps` rendered an amber volume around West corridor and listed both recapture instructions.
6. Searching for `bench` returned two entities.
7. Selecting Platform bench 1 animated the camera to the platform level.
8. `get_scene_context` returned camera position `[-3.168, 4.67, 2.22]`, target `[-1.44, 4.22, -0.18]`, region `platform_2_zone`, selection `bench_1`, and visible IDs `lift_2`, `bench_1`, and `bench_2` for that view.

The exact camera numbers are a receipt for this run, not a fixed product requirement.

## Captured-file loader

Loaded Spark's public `butterfly.spz` sample through the `splat` query parameter. The compressed Gaussian asset rendered inside the same scene with no console errors. This verifies the external `.spz` loader. It does not verify semantic alignment because the sample is not a station.

## Responsive check

At a 390 by 844 viewport, the page used a single-column layout. The 3D scene, mode toggle, action buttons, semantic search, details, and tool console remained reachable without horizontal overflow.

## Guided judge path

The one-click guided proof completed in the normal human interface with six successful, source-labelled runtime calls. All five mission steps reached their completed state. After undo, Lift 1 was open, the staged-change count was zero, and both the derived route and quality overlays were empty. This caught and closed a stale-overlay bug: scene-state changes now invalidate any route or evidence overlay computed against the previous state.

The same proof was repeated from a fresh tab against the public Cloudflare Workers URL on August 27, 2026. The production page rendered the 12,026-splat fixture, completed all five steps, restored the baseline, retained the West corridor evidence explanation, and produced no browser console messages.

## Public Cloudflare Workers deployment

The public app is https://semantic-spatial-webmcp.swmengappdev.workers.dev/. The deployment verifier accepted clean commit `13143cb36672f45cbcfe534f269d7c2db47d76a2`, checked all 14 publicly served files against the build-manifest byte counts and SHA-256 hashes, verified the required WebMCP and security headers, and confirmed that both `_headers` and an unknown path return 404. The machine-readable receipt is `docs/public-deployment-verification.json`.

## Real Chrome WebMCP check

Verified on August 27, 2026 against the public Cloudflare Workers URL with Google Chrome 151.0.7922.174 and the `WebMCPTesting` feature enabled in an isolated profile.

- The URL exposed `build-manifest.json` from the allowlisted `dist/` artifact; the receipt records its SHA-256, build commit, dirty flag, and file count.
- Navigation-to-WebMCP-ready time stayed below the five-second launch criterion; the exact conservative timing is in the JSON receipt.
- The page reported `WebMCP active: 10 tools registered` only after the shared viewer loaded.
- `document.modelContext.getTools()` returned the ten expected tools with standardized annotations.
- Calls through `document.modelContext.executeTool()` used public place labels and returned plain JSON.
- `navigate_to_entity` moved to the exact position and target of `view_accessible_gate_1`; the follow-up context reported the named view, camera pose, nearby hidden entities, connected spaces, and a truthful null region because that camera sits outside a semantic zone.
- The first route used Lift 1.
- Closing `lift_1` changed the alternate route to Lift 2.
- The alternate route warned on `west_corridor`.
- Region quality returned 0.56 accessible-wayfinding readiness, the `view_sign_west_oblique` evidence record, and two recapture recommendations rendered as 3D markers with sightlines.
- Undo restored the staged-change count to zero.
- The visible timeline labelled each call `agent`. A subsequent page-button route call was labelled `human`.
- The browser console contained no application errors.

The public-production receipt is `docs/cloudflare-workers-verification.json`; its final-state screenshot is `submission/screenshots/cloudflare-workers-webmcp.png`. The earlier local artifact receipt remains in `docs/webmcp-chrome-verification.json` with `submission/screenshots/chrome-webmcp-flow.png`.

Chrome 151's manual execution API required a JSON string. Passing an object produced `UnknownError: Failed to parse input arguments`. Chrome 151 also passed no second argument to the page's `execute` callback. An outer `AbortSignal` rejected the caller with `AbortError`, but the page tool continued and logged success. Cancellation remains unit-tested for clients that provide the documented execution signal; it is not claimed as verified in Chrome 151.

## Artifacts

Transient Playwright screenshots remain under ignored `output/playwright/`. The checked-in production receipt and project-only screenshot are the public challenge evidence for the imperative WebMCP flow.
