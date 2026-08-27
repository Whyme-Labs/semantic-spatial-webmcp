# Demo script

Target duration: 158 seconds. Hard limit: 179 seconds. The narration is generated in one continuous VoxCPM2 pass, then the edit cuts the verified public replay to the aligned speech beats.

## Shot list

Each story beat contains two shots. Cuts land in the gap between aligned beats, never in the middle of a sentence. Continuous pan and zoom keeps static evidence readable without freezing the frame.

| Time | Picture | Narration |
|---:|---|---|
| 0:00–0:14 | Cold-open close-up on the route failure, then cut to the SceneIndex identity and full station. | "One lift closes. For a wheelchair user in an unfamiliar station, that red status can erase the route they expected. A beautiful 3D scan still looks complete. It does not know the journey has broken." |
| 0:14–0:29 | Establish the full station, then move into the live Gaussian scene and semantic proxies. | "SceneIndex gives the place memory and language. The Gaussian splat remains the visual record. Persistent rooms, gates, lifts, routes, and evidence sit underneath it. A person sees the station. An agent reasons about the same station." |
| 0:29–0:42 | Cut to the mission card, then to the accessible gate in the shared viewer. | "The job is simple. Get from Entrance A to Platform 2 without stairs, and do not hide uncertainty. The agent reads the live camera, finds the accessible gate, and moves the shared view to the evidence position." |
| 0:42–0:54 | Draw the Lift 1 baseline route, then show the matching mission state. | "The first answer is ordinary. Follow the east corridor. Take Lift 1. Continue to the platform. The route appears in the scene, so every turn can be inspected instead of trusted blindly." |
| 0:54–1:07 | Cut to the closure state and then the invalidated route in the viewer. | "Then Lift 1 closes. The proxy turns red, the operational state changes, and the route becomes invalid. Nothing is silently rewritten. The outage is visible to both sides, and it can be undone." |
| 1:07–1:20 | Reveal the Lift 2 route, then reframe toward the West corridor warning. | "The agent searches again. Lift 2 keeps the trip possible, but the alternate path crosses the West corridor. SceneIndex finds a route and raises a warning. Accessible-wayfinding readiness is only fifty-six percent." |
| 1:20–1:33 | Cut into the evidence panel, then return to the marked weak region. | "That number has a reason. The directional sign has one oblique, low-resolution observation. Connectivity is known, but the text is not verified. The page exposes that doubt and marks the weak region." |
| 1:33–1:46 | Show the recommendation text, markers, and sightlines in two close views. | "Now the system looks beyond navigation. It recommends a front-facing sign capture at eye level, then a reverse corridor pass from Lift 2. Six markers and sightlines turn better coverage into fieldwork someone can perform." |
| 1:46–1:59 | Cut to the undo control, then return to the clean full-scene baseline. | "The person stays in control. Inspect the route, challenge the evidence, accept the recommendation, or undo the outage. One action restores Lift 1 and clears the staged change. The baseline is clean again." |
| 1:59–2:13 | Pan across the verified ten-call timeline in two readable shots. | "WebMCP connects to the live interface, not a separate backend copy. Ten narrow tools share validation, scene state, camera, visual effects, and the action timeline with human controls. Every agent call is labelled and observable." |
| 2:13–2:27 | Use the project-authored screenshot-versus-spatial-context comparison to connect the fixture to field work. | "The station is synthetic, but the pattern is practical. A registered capture could support accessibility review, building handover, remote inspection, maintenance, and targeted recapture. The agent never has to pretend the pixels know more than they do." |
| 2:27–2:38 | Resolve on the SceneIndex identity, live app, and full station. | "SceneIndex makes a place searchable, testable, and honest about its evidence. When the world changes, the route changes with it. Search the place. See the reason. Keep the decision in view." |

## Demo prompts

These prompts define the real WebMCP flow shown by the source capture.

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

- Capture the public production URL in a fresh isolated Chrome profile.
- Require ten successful agent-labelled WebMCP calls and an empty browser-error list.
- Generate the whole 406-word narration in one VoxCPM2 inference. Do not synthesize beats separately.
- Require full-track forced alignment for all 12 beats.
- Run `npm run verify:demo-audio`; reject excessive silence or the measured hum band.
- Build 24 shots from the aligned beat boundaries.
- Keep every planned shot below nine seconds.
- Require at least eight detected cuts and no freeze event longer than eight seconds.
- Do not add music or third-party media.
- Export at 1920 by 1080, 30 fps, H.264 with 48 kHz AAC narration.
- Run the exact-file video verifier and watch the finished export with sound.
- Upload to YouTube as Public and check the URL while signed out.
