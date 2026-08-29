# Demo script

Target duration: 103 seconds. Hard limit: 179 seconds. The narration is generated in one continuous VoxCPM2 pass, cleaned as one full track, then the edit cuts the verified public replay to the aligned speech beats.

## Shot list

Each story beat contains two shots. Short charcoal-and-teal fades land in the gaps between aligned beats, never in the middle of a sentence. Continuous pan and zoom, exact live-call overlays, and project-authored UI ticks keep the evidence active without obscuring it.

| Time | Picture | Narration |
|---:|---|---|
| 0:00–0:09 | Cold-open close-up on the failed route with a live `set_entity_state` call, then reveal SceneIndex. | "Traditional 3D scans can look complete while missing the instant an accessible route breaks. One lift closes, and the expected journey disappears." |
| 0:09–0:19 | Establish the full station and live Gaussian scene with the shared context call visible. | "SceneIndex adds persistent meaning beneath the Gaussian splat: rooms, gates, lifts, routes, and evidence that people and agents share." |
| 0:19–0:28 | Frame the mission card, then move to the accessible gate while naming both live calls. | "The mission: reach Platform 2 from Entrance A without stairs, while exposing uncertainty. The agent reads the camera and finds the accessible gate." |
| 0:28–0:35 | Draw the Lift 1 baseline route and keep its exact route call on screen. | "The first route uses the east corridor and Lift 1. It appears in the scene, where every turn stays inspectable." |
| 0:35–0:44 | Close Lift 1, show the red state, and mark the baseline route invalid. | "Then Lift 1 closes. Its proxy turns red, its state changes, and the route fails visibly. The outage is reversible, never hidden." |
| 0:44–0:53 | Reveal the Lift 2 reroute and the West corridor warning in two active views. | "The agent reroutes through Lift 2. The trip remains possible, but the West corridor raises a warning: wayfinding readiness is only just over half." |
| 0:53–1:01 | Punch into the guided-proof evidence at 56%, then return to the marked weak region. | "Why? The directional sign has one oblique, low resolution view. Connectivity is known, but its text remains unverified." |
| 1:01–1:11 | Show the recommendation panel, field positions, and capture sightlines. | "SceneIndex turns doubt into fieldwork: recapture the sign front-on, then walk a reverse pass from Lift 2. Six markers make the plan concrete." |
| 1:11–1:18 | Put `undo_scene_change` on screen, then return to the clean baseline. | "The person keeps control: inspect, challenge, accept, or undo. One action restores Lift 1 and the clean baseline." |
| 1:18–1:27 | Pan across readable timeline crops while four animated focus cards isolate the exact call and result. | "Web M C P connects to this live interface. Ten narrow tools share scene state, validation, effects, and a human-visible action timeline." |
| 1:27–1:36 | Use the project-authored screenshot-versus-spatial-context comparison to connect the fixture to fieldwork. | "The station is synthetic, but this pattern supports accessibility review, handover, inspection, maintenance, and targeted recapture without pretending pixels know more." |
| 1:36–1:43 | Resolve on the SceneIndex identity, live app, and full station. | "SceneIndex makes a place searchable, testable, and honest about evidence. When the world changes, the route changes with it." |

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
- Generate the whole 247-word narration in one VoxCPM2 inference. Do not synthesize beats separately.
- Require full-track forced alignment for all 12 beats.
- Clean the narration as one full track, then rerun full-track alignment.
- Run `npm run verify:demo-audio`; reject excessive silence, hum coverage, or inter-beat vocal leakage.
- Build 24 shots from the aligned beat boundaries.
- Keep every planned shot below nine seconds.
- Require at least eight detected cuts and no freeze event longer than eight seconds.
- Use only the project-authored procedural score and UI cues. Do not add third-party media.
- Export at 1920 by 1080, 30 fps, H.264 with 48 kHz AAC narration and project-authored UI ticks.
- Run the exact-file video verifier and watch the finished export with sound.
- Upload to YouTube as Public and check the URL while signed out.
