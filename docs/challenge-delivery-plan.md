# WebMCP challenge delivery plan

Verified against the official OpenAI challenge page and the published Devpost rules on August 26, 2026. Recheck the live rules before final submission because the organizer's published rules control.

## Deadline

The published deadline is September 3, 2026 at 1:00 p.m. Pacific Daylight Time.

That is September 4, 2026 at 4:00 a.m. Malaysia time. Treat September 3 at 10:00 p.m. Malaysia time as the internal submission cutoff. The remaining six hours are contingency, not development time.

## Required submission package

Prepare all of the following before the internal cutoff:

- A working publicly accessible application URL
- A public source-code repository
- An OSI-compatible open-source license in the repository
- A clear record of challenge-period work if the project existed before the challenge
- An English project description
- A public demonstration video on YouTube, no longer than three minutes
- The requested Devpost submission fields and media
- Test credentials or a frictionless demo path if authentication exists
- A submission made by an eligible entrant or team under the applicable geography rules

## Rules that affect implementation

### Existing work

An existing viewer can be used, but only work completed during the challenge period should be presented as challenge work. Create a baseline tag before integration and maintain `CHALLENGE_DELTA.md`.

### Public reproducibility

The repository should contain:

- License
- Setup instructions
- Architecture overview
- Semantic fixture or generator
- WebMCP tool definitions
- Tests
- Deployment instructions
- A challenge-delta record

Avoid relying on private services that prevent judges from reproducing the core experience.

### Demo accessibility

The live site must load reliably. Do not require a scanner, local GPU, account approval, private VPN, or large asset download for the judged path. Use a compressed scene and a deterministic semantic sidecar.

### Submission identity

Submit through the eligible Malaysia-based entrant or entity that owns or is authorized to submit the code. Do not route the entry through an excluded geography.

## Judging alignment

The published judging structure gives equal weight to four dimensions:

1. Effective use of WebMCP
2. Technical execution
3. Potential impact
4. Creativity and originality

WebMCP use is also strategically important because a generic AI or 3D application with a superficial tool wrapper will not distinguish itself.

### Effective WebMCP use

Evidence to show:

- Tools read the current camera, room, visible entities, and selection
- The agent performs a multi-tool workflow
- Agent actions visibly update the shared scene
- Tools register only when relevant where practical
- State-changing tools stage reversible changes
- Outputs are compact, typed, and grounded in scene evidence
- The interaction would be materially worse through screenshots alone

### Technical execution

Evidence to show:

- Fast scene load
- Stable object IDs
- Deterministic route planning
- Correct state invalidation after a lift or barrier changes
- Explicit confidence and provenance
- Clear unsupported-answer behavior
- Unit and integration tests
- Mobile-safe controls and a reliable fallback

### Potential impact

Use one concrete story. An accessible transit route is easy to understand. The architecture then expands into facility navigation, inspection, construction, heritage, and robotics.

Do not pitch "AI for all spatial computing." Show one finished job and explain why the same semantic control plane generalizes.

### Creativity

The conceptual contribution is the spatial DOM:

- 3DGS supplies appearance
- The semantic graph supplies persistent meaning
- Quality records expose evidence gaps
- Scenario state makes the place reversible
- WebMCP gives an agent typed control over the same spatial workspace a human sees

## Challenge deliverables

### 1. Public application

Launch criteria:

- Initial meaningful content in under five seconds on a normal broadband connection
- No mandatory account creation
- One-click sample prompts
- A visible WebMCP connection indicator
- A deterministic fallback tool console
- Accessible route demo works from a fresh session
- Scene state can reset instantly
- Mobile layout does not block the viewer

### 2. Public repository

Expected top-level contents:

```text
README.md
LICENSE
CHALLENGE_DELTA.md
docs/
src/
test/
scene-data/
deployment/
```

Create the baseline tag before challenge code is merged.

### 3. Three-minute video

Target length: 165 to 175 seconds.

Suggested script:

| Time | Content |
|---:|---|
| 0:00-0:15 | The problem: a photorealistic scene has no persistent understanding |
| 0:15-0:35 | Show the spatial DOM and current scene context |
| 0:35-1:15 | Ask for an accessible route and watch the agent query, route, and navigate |
| 1:15-1:45 | Close Lift 1 and recalculate visibly through Lift 2 |
| 1:45-2:15 | Expose the weakly captured sign and show evidence plus recapture guidance |
| 2:15-2:40 | Correct or approve one entity/state change, then undo or commit |
| 2:40-2:55 | Show the WebMCP tool surface and public repository |
| 2:55-3:00 | Product statement and live URL |

The video should show the browser and agent working together. Avoid spending most of the video on slides.

### 4. Written submission

Draft these sections:

- One-sentence product description
- Problem
- What the application does
- Why WebMCP is necessary
- How it was built
- Technical decisions
- Challenges encountered
- What was accomplished during the challenge
- What comes next
- Links to the live application, repository, and video

### 5. Evidence package

Keep the following in the repository or submission media:

- Architecture diagram
- Tool list with schemas
- Before and after challenge baseline
- Test results
- Screenshot-only versus spatial-context comparison
- Route invalidation demonstration
- Capture-confidence demonstration

## Build order

### P0: end-to-end judged path

- Integrate the existing 3DGS viewer through `SpatialViewerAdapter`
- Load the MRT semantic sidecar
- Register core WebMCP tools
- Search and navigate to entities
- Compute an accessible route
- Close Lift 1 and recalculate
- Surface a low-confidence corridor region
- Reset the scene
- Deploy a public URL

### P1: trust and polish

- Best evidence views
- Quality overlay
- Recapture markers
- Human correction flow
- Tool call timeline
- Mobile controls
- Loading and error states
- Evaluation suite

### P2: optional differentiation

- Move one segmented entity
- Persist a scenario deep link
- Compare two captures
- Generate a guided tour
- Export a route or inspection summary

Do not start P2 until the complete P0 path works from a clean browser.

## Daily sequence

### August 26

- Freeze the product story
- Create baseline tag and challenge branch
- Land the semantic core, route engine, tool registry, tests, and fixture

### August 27

- Connect the real viewer adapter
- Bind semantic IDs to splat groups or proxy bounds
- Implement best-view camera navigation

### August 28

- Build WebMCP route workflow and visible tool timeline
- Add operational lift and barrier state

### August 29

- Add capture-confidence overlay and evidence panel
- Add recapture recommendations

### August 30

- Add correction, undo, reset, and scenario review
- Test mobile controls and scene loading

### August 31

- Run the evaluation set
- Fix grounding, route, and state bugs
- Confirm browser and ChatGPT compatibility

### September 1

- Freeze features
- Deploy production build
- Draft the submission and record a rough video

### September 2

- Run fresh-session tests
- Record and edit the final video
- Finish screenshots and written entry

### September 3

- Submit before 10:00 p.m. Malaysia time
- Keep the remaining window for submission or hosting failures only

## Acceptance tests

The entry is ready only when all of these pass:

- "Find the accessible fare gate" returns and highlights the correct entity
- "Take me from Entrance A to Platform 2 without stairs" returns a valid route
- Closing Lift 1 invalidates the original route
- The alternate route uses Lift 2
- The alternate route reports the weakly captured corridor
- The evidence panel explains why confidence is low
- A recapture recommendation is visible and concrete
- A nonexistent entity returns not found without inventing an answer
- Scene changes can be undone and reset
- The same tool calls work through WebMCP and the local debug runtime
- The public app works from a fresh browser without local state

## Official sources

- OpenAI WebMCP Challenge: https://openai.com/webmcp-challenge/
- Published challenge rules: https://webmcp.devpost.com/rules
- WebMCP documentation: https://learn.chatgpt.com/docs/webmcp
