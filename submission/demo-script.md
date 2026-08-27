# Demo script

Target duration: 170 seconds. Hard limit: 179 seconds. Record against the public production build with real Site Tools enabled.

## Shot list

| Time | Picture | Narration |
|---:|---|---|
| 0:00–0:12 | Open the public app on the full station view. Show the Site Tools indicator. | "A Gaussian-splat capture can show a place beautifully and still tell an agent almost nothing about what the place means. This is Semantic Spatial Browser." |
| 0:12–0:27 | Orbit the scene. Point to entity labels and the WebMCP status. | "The page combines Gaussian appearance with persistent rooms, objects, relationships, routes, operational state, and capture evidence. The person and the agent work on the same live scene." |
| 0:27–0:38 | Show the first prompt in ChatGPT. | "I will ask for an accessible route from Entrance A to Platform 2 and ask whether the evidence is trustworthy." |
| 0:38–1:03 | Let the agent call context, search, navigation, and route tools. Keep the 3D route and call timeline visible. | "The agent reads the current page, finds the accessible gate, moves the shared camera, and draws a route through Lift 1. The result is visible and inspectable. It is not a route hidden in a backend response." |
| 1:03–1:17 | Show the second prompt. Let the agent stage Lift 1 as closed. | "Now I change the situation. Lift 1 is unavailable. The agent stages that state on the page. The lift turns red, and the change remains reversible." |
| 1:17–1:39 | Let the agent reroute through Lift 2. Hold on the evidence warning. | "The original path is no longer valid. The new route uses Lift 2, but the West corridor has only 56 percent accessible-wayfinding readiness. Connectivity is known. The sign text is not visually verified." |
| 1:39–1:57 | Show the amber quality volume, evidence gaps, and recapture instructions. | "The agent opens the capture evidence instead of guessing. The page highlights the weak region and explains the unreadable sign and single-view coverage gap." |
| 1:57–2:15 | Navigate to the recapture position or point to the two recommendations. | "It recommends a front-facing sign capture and a reverse corridor pass from the Lift 2 side. Capture quality becomes a task-specific decision, not one opaque percentage." |
| 2:15–2:31 | Undo the scenario. Show Lift 1 and the route return to baseline. | "I can inspect, accept, or undo every change. Undo restores the baseline scene without reloading the page." |
| 2:31–2:48 | Open Available Site Tools and the visible timeline. | "The app exposes ten narrow tools through the current imperative WebMCP API. Human controls and agent calls share the same runtime, validation, viewer effects, and visible timeline." |
| 2:48–2:55 | Show the public repository and challenge-delta file. Return to the app title. | "The app, source, license, tests, provenance, and build receipts are public. Search a place. Understand it. Test what happens when it changes." |

## Demo prompts

Use these prompts verbatim in a fresh Site Tools session.

### Prompt 1

```text
Find the accessible gate, then take me from Entrance A to Platform 2 without stairs. Draw the route in the scene and tell me whether the available capture evidence is trustworthy.
```

Expected tool intent:

```text
get_scene_context
search_entities
navigate_to_entity
find_semantic_route
```

### Prompt 2

```text
Stage Lift 1 as closed, recalculate the accessible route, inspect any weak evidence on the alternate path, and show the concrete recapture guidance.
```

Expected tool intent:

```text
set_entity_state
find_semantic_route
get_region_quality
```

### Prompt 3

```text
Undo the staged outage and confirm that the station is back at its baseline state.
```

Expected tool intent:

```text
undo_scene_change
get_scene_context
```

## Recording checklist

- Record the final public HTTPS URL, not localhost.
- Start from a fresh browser profile and a fresh Site Tools conversation.
- Use GPT-5.6 Sol or GPT-5.6 Terra.
- Show the Site Tools indicator and Available Site Tools list.
- Keep the 3D scene, details panel, and source-labelled timeline readable.
- Confirm that the first route uses Lift 1.
- Confirm that the alternate route uses Lift 2 and reports 56 percent readiness.
- Show both recapture recommendations.
- Show undo restoring the baseline.
- Show the public repository, root license, and `CHALLENGE_DELTA.md`.
- Record clear English narration. Do not add music.
- Remove private tabs, notifications, account details, bookmarks, and unrelated marks.
- Export at 1080p or higher.
- Run `npm run verify:demo-video -- --video <path-to-mp4> --output docs/demo-video-verification.json`.
- Confirm that the final duration is below 3:00. Aim for 2:45 to 2:55; the verifier rejects the 3:00 boundary.
- Watch the exported file with sound before uploading.
- Upload to YouTube as Public, not Unlisted or Private.
- Open the public YouTube URL in a signed-out browser before submission.
