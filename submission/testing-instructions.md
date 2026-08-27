# Judge testing instructions

The submitted production app must be public and require no account. Verify both conditions after deployment; they are not claimed from this local package.

## Recommended environment

Use either official environment named by the rules. In the ChatGPT desktop app, open the submitted URL in its built-in browser; Site Tools are not available on `chatgpt.com` in Chrome.

Alternatively, use Chrome 149 or later. Enable `chrome://flags/#enable-webmcp-testing`, relaunch Chrome, and open the submitted app URL. The checked-in production receipt uses Chrome 151.

## Two-minute test

1. Confirm that the page status reports `WebMCP active: 10 tools registered`.
2. Click **Run guided proof** for a 30-second human-interface preview. Confirm that all five steps complete and the scene returns to a clean baseline.
3. Ask: "Find the accessible gate, then take me from Entrance A to Platform 2 without stairs. Draw the route and tell me whether the evidence is trustworthy."
4. Confirm that the route uses Lift 1 and appears in the 3D scene.
5. Ask: "Stage Lift 1 as closed, recalculate the accessible route, inspect any weak evidence on the alternate path, and show the concrete recapture guidance."
6. Confirm that Lift 1 turns red, the route moves to Lift 2, and the West corridor reports 56 percent accessible-wayfinding readiness.
7. Confirm that the amber quality volume, two evidence gaps, and two recapture recommendations appear.
8. Ask the agent to undo the staged outage.
9. Confirm that Lift 1 returns to its baseline state without a page reload and that stale route/evidence overlays disappear.
10. Review the source-labelled tool timeline on the page.

## Human-interface fallback

If Site Tools are unavailable, the same route, outage, quality, undo, and reset operations remain available as page controls. Use **Show 2D map** if WebGL is unavailable.

The fallback proves product continuity. It does not replace WebMCP verification; `docs/cloudflare-workers-verification.json` records the complete flow in the rules' Chrome alternative.

## Repository receipts

Run `npm run verify`, `npm run eval`, and `npm run deploy:dry-run`. While the built app is served locally, run `npm run verify:webmcp:chrome`. The deterministic prompt fixture and Chrome receipts prove WebMCP behavior, not model selection; no model-backed result is claimed.
