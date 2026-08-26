# WebMCP Challenge submission requirements

Current as of **August 26, 2026**. This report uses only first-party sources: OpenAI, the official Devpost challenge pages, the Web Machine Learning Community Group draft, and Chrome's implementation documentation.

## Controlling sources and dates

The controlling source for eligibility, deadlines, project rules, and judging is the [Devpost Official Rules](https://webmcp.devpost.com/rules). The rules say that the Official Rules and Hackathon Website prevail over plugin output or other inconsistent material. The [live Devpost overview](https://webmcp.devpost.com/) and [OpenAI challenge page](https://openai.com/webmcp-challenge/) are useful summaries, but the rules control.

- Registration and submission opened **August 25, 2026 at 11:00 AM Pacific Time** and close **September 3, 2026 at 1:00 PM Pacific Time**. Devpost labels the deadline PDT, so this is **20:00 UTC** and **September 4 at 4:00 AM Malaysia time**.
- Judging runs **September 4 at 10:00 AM PT through September 21 at 5:00 PM PT**.
- Winners are due on or around **September 23 at 2:00 PM PT**; OpenAI notes that the announcement date can move.
- The OpenAI summary says registration opened at noon, while the rules say 11:00 AM. Use the rules' **11:00 AM** time for any existing-work/provenance cutoff.

## Eligibility

An entrant may be an individual who has reached the age of majority where they live, a team of eligible individuals, or an organization organized in an eligible jurisdiction. Individuals and organizations must be resident/domiciled in a country that currently supports OpenAI API access and must not fall within a legal, sanctions, organizer, judge, affiliate, or conflict-of-interest exclusion. Teams and organizations must appoint an eligible representative. Malaysia is on OpenAI's current [supported-country list](https://developers.openai.com/api/docs/supported-countries), but the entrant still must personally attest to every rule. The complete exclusions and definitions are in [Official Rules section 3](https://webmcp.devpost.com/rules).

The rules allow an eligible person to participate in more than one team or organization and also individually. A later clause says an entrant may not submit more than one submission, then refers inconsistently to that entrant's “other submissions.” Until Devpost clarifies, the conservative interpretation is **one submission per entrant identity**.

## Required submission package

The submission must include all of the following ([Devpost overview](https://webmcp.devpost.com/); [Official Rules section 4](https://webmcp.devpost.com/rules)):

1. A functioning WebMCP-powered web app that works consistently as depicted and reasonably fits the human-agent collaboration theme.
2. A live URL that judges can open in ChatGPT's in-app browser or Google Chrome with WebMCP enabled. Any host is allowed. Authentication is allowed only if credentials and testing instructions are supplied.
3. English text—or English translations—explaining:
   - why the use case is a strong WebMCP fit;
   - how it improves the user experience;
   - what people and agents can do together that was difficult or impossible before; and
   - briefly, how WebMCP was implemented.
4. A **public** GitHub, GitLab, or Bitbucket repository containing all source code, assets, instructions needed to run the project, and an open-source license file. The license must be detectable and visible near the top of the repository page/About area.
5. A **public YouTube** demo with audio that clearly shows the functioning project and explains what was built and how WebMCP is used. It must be **less than three minutes**, not three minutes exactly; judges need not watch beyond three minutes. It may not use third-party marks, copyrighted music, or other protected material without permission.
6. Free, unrestricted judge access through the end of judging. If the app is private, working credentials must be supplied. Judges may choose not to run it and may judge only the description, images, and video, so those artifacts must stand alone.

Drafts may be edited until the deadline. After the submission period, the submission itself cannot be changed except for narrowly authorized removals/replacements of infringing, private, or inappropriate material. Updating the separate Devpost portfolio does not update the judged submission ([Official Rules section 6](https://webmcp.devpost.com/rules)).

## Existing work, ownership, and provenance

Projects may be newly created during the submission period. A project that predates **August 25, 2026 at 11:00 AM PT** must have been meaningfully extended with WebMCP after that time; only the in-period additions are judged. The entrant must clearly distinguish old and new work with dated commits, timestamps, or equivalent evidence ([Official Rules, “New & Existing”](https://webmcp.devpost.com/rules)).

The submission must be original, solely owned by the entrant/team/organization, and non-infringing. Third-party SDKs, APIs, data, assets, and open-source components are allowed only with the required authorization and license compliance; an open-source base must be genuinely enhanced. Contracted technical assistance is allowed only where the entrant owns the resulting submission and it embodies the entrant's ideas and creativity. A project developed with financial or preferential support from OpenAI or Devpost before the deadline may be disqualified ([Official Rules, intellectual property and support](https://webmcp.devpost.com/rules)).

Repository implication: preserve the initial commit and every in-period commit, retain `CHALLENGE_DELTA.md`, and inventory the licenses and provenance of Spark, Three.js, any splat/capture, icons, fonts, screenshots, and video media. Do not claim the synthetic station as captured data.

## Judging and tie-breaks

Stage one is pass/fail: the project must reasonably fit the theme and reasonably apply the required API/SDK. Stage two scores four **equally weighted** criteria—effectively 25% each ([Official Rules section 7](https://webmcp.devpost.com/rules)):

1. **WebMCP Leverage** — thorough, skillful, genuinely non-trivial working use of WebMCP.
2. **Execution** — a complete, coherent working/runnable product experience, not merely a technical proof of concept.
3. **Potential Impact** — a credible, specific real problem and audience that the demonstrated solution actually addresses.
4. **Creativity & Ambition** — novelty and differentiation from existing concepts.

Tie-breaks compare the criteria in that order: WebMCP Leverage, Execution, Potential Impact, then Creativity & Ambition. If still tied on all four, the judges vote. Judging may include expert panels, peer review, automated AI analysis, or a combination, and may occur in multiple rounds.

## Current Site Tools and WebMCP implementation contract

WebMCP remains an experimental **Draft Community Group Report**, not a W3C Standard. The current draft is dated August 26, 2026 ([WebMCP draft](https://webmachinelearning.github.io/webmcp/)). For this challenge, the safest interoperability target is the current imperative API that Devpost itself shows in its repository requirement:

```js
if (typeof document.modelContext?.registerTool === "function") {
  await document.modelContext.registerTool({
    name: "get_scene_context",
    description: "Read the current scene context.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async (input, { signal }) => ({ /* JSON-serializable result */ }),
  });
}
```

The normative entry point is **`document.modelContext`**, not `navigator.modelContext`. `registerTool()` returns a Promise and must be checked/awaited. A tool definition requires a non-empty unique `name`, non-empty `description`, and `execute` callback; `inputSchema`, `title`, and `annotations` are optional in the draft, although Chrome's developer guide tells authors to provide a relevant schema. Names are 1–128 characters and restricted to ASCII letters/digits plus `_`, `-`, and `.`. Schemas must be JSON-serializable. Execution may return any JSON-serializable value or Promise of one, and its second argument supplies an `AbortSignal` for cancellation ([draft API and tool dictionary](https://webmachinelearning.github.io/webmcp/#modelcontext-interface); [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)).

Tools should reuse the application's existing logic, authentication, authorization, and validation, update the same visible interface, keep inputs narrow, explain side effects, and return enough information to verify the result. The normal human interface must continue to work in browsers without WebMCP ([OpenAI Site Tools guide](https://learn.chatgpt.com/docs/webmcp)).

Only two annotations are in the current WebMCP draft:

- `readOnlyHint: true` means the tool does not modify state.
- `untrustedContentHint: true` means the output contains data the site author considers untrusted.

Both default to false. These are hints, not enforcement or proof of behavior. `destructiveHint` and `idempotentHint` are **not members of the current WebMCP `ToolAnnotations` dictionary**, so the submission should not rely on them ([current tool dictionary](https://webmachinelearning.github.io/webmcp/#modelcontexttool-dictionary)).

## Security and browser constraints

- Site tools run in the live page and signed-in browser session. Tool definitions and results are untrusted content; a name or `readOnlyHint` is not evidence of safety. ChatGPT applies a safety review to each invocation, but normal authorization, confirmation, and consequence policies still apply ([OpenAI Site Tools security](https://learn.chatgpt.com/docs/webmcp#security-and-user-controls)).
- Preserve all UI-side authorization and input validation in the tool path. Avoid tool metadata or outputs that contain instructions to the agent. Mark user-generated or external output with `untrustedContentHint`; accurately mark truly read-only tools ([Chrome tool-security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools)).
- Chrome recommends budgets of **500 characters per tool description, 150 per parameter description, 30 per tool/parameter name, and 1.5K per individual tool output**. These are recommendations rather than current specification limits.
- The API is Secure Context-only and requires origin isolation. Enabling `document.domain`, including via `Origin-Agent-Cluster: ?0`, disables it. The `tools` Permissions Policy defaults to `self`; cross-origin iframes require `allow="tools"`, and cross-origin exposure additionally requires explicit secure origins in `exposedTo` ([Chrome WebMCP security and permissions](https://developer.chrome.com/docs/ai/webmcp?hl=en); [draft permissions policy](https://webmachinelearning.github.io/webmcp/#permissions-policy-integration)).
- Register only tools useful in the current page state, avoid overlapping responsibilities, update the UI after completion, validate strictly in application code, and return meaningful errors. There is no specified maximum tool count, but every tool consumes context and overlapping tools reduce selection reliability ([Chrome best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)).
- The declarative portion of the current Community Group draft remains marked TODO. Chrome documents both declarative and imperative implementations, but Devpost explicitly shows `document.modelContext.registerTool(...)`; do not rely on declarative forms alone for this entry.

## Supported judging and test environments

- **Challenge baseline:** latest ChatGPT desktop app with its in-app browser, or **Chrome 149 or later** with `chrome://flags/#enable-webmcp-testing` enabled and the browser restarted ([Official Rules, “How To Enter”](https://webmcp.devpost.com/rules)).
- **ChatGPT Site Tools:** use **GPT-5.6 Sol or GPT-5.6 Terra**. GPT-5.6 Luna currently has WebMCP disabled. Site tools are not available in Enterprise or Edu workspaces and availability remains rollout-dependent ([OpenAI Site Tools guide](https://learn.chatgpt.com/docs/webmcp)). The challenge rules do not mandate a particular model.
- **Chrome:** the origin trial starts with Chrome 149; the local flag is the official development path. Chrome says the API is designed mainly for local, human-in-the-loop browser workflows, not headless-only operation, and a client must visit the page to discover its tools ([Chrome WebMCP guide](https://developer.chrome.com/docs/ai/webmcp?hl=en)).
- Deterministic tests should prove tool logic, side effects, UI updates, validation, and results. Model-backed evals should prove correct tool selection, arguments, chaining, and end-to-end user journeys, including failure recovery ([Chrome WebMCP evals](https://developer.chrome.com/docs/ai/webmcp/evals)).

There is implementation drift in current primary sources: the Community Group draft defines `executeTool()` with an object input, while Chrome's imperative guide currently describes manual execution with a JSON string. This does not change page-side `registerTool()`/`execute()` registration. Avoid depending on in-page `executeTool()` for the submission's product path, and test the deployed registration with the actual judge environments.

Local Chrome 151 evidence on August 27 confirmed that drift. Manual `executeTool()` accepted a JSON string and rejected an object. The registered page callback received no second execution-context argument, so caller cancellation rejected the outer Promise but did not propagate a signal into the tool. The app keeps forward-compatible signal handling, but Chrome 151 cancellation is not a verified capability claim.

## Repository evidence gates

| Requirement | Evidence the final repository/package must provide |
|---|---|
| In-period work | Preserved Git history, earliest/baseline SHA and timestamp, and a clear challenge delta. |
| Real WebMCP | Visible `document.modelContext.registerTool(...)` source; awaited registration with errors surfaced; discovery and execution proven in ChatGPT's browser and Chrome 149+. |
| Non-trivial human-agent experience | A fresh-session UI and site-tool flow in which both act on the same live 3D scene, with visible, verifiable state changes. |
| Complete runnable product | Public HTTPS app, clean fresh-profile load, no private dependencies, complete setup/deploy instructions, and graceful non-WebMCP behavior. |
| Tool reliability | Schema/logic tests, real browser receipts, model-backed selection/chaining evals, failure cases, and outputs that fit security budgets. |
| Security | Correct standardized annotations, narrow inputs, authorization/validation parity, safe external-content handling, and confirmation/review for consequential actions. |
| Public source and license | Public GitHub/GitLab/Bitbucket URL, root license recognized by the host, all necessary source/assets, and third-party license/provenance inventory. |
| Judge access | Live URL and any credentials/test instructions; free unrestricted access until September 21 at 5:00 PM PT. |
| Submission narrative | English copy addressing all four required questions and explicitly mapping evidence to the four equal judging criteria. |
| Demo | Public YouTube URL; duration under 3:00; audio; real deployed app and real WebMCP calls; no unlicensed marks/music/media. |

## Initial repository implications observed on August 26, with disposition

- The first commit, `8949b3c`, is timestamped **2026-08-26T11:10:00Z**, after the rules' submission-period start. Preserve it and the current challenge-delta record.
- A root MIT `LICENSE` exists and the source uses `document.modelContext.registerTool`; those are necessary but not sufficient until a public host recognizes the license and real judge-browser registration is recorded.
- The initial `registerWebMCPTools()` did not await the Promise returned by `registerTool()`. This was resolved with awaited all-or-none registration before the final Chrome receipt.
- The initial runtime included non-standard `destructiveHint` and `idempotentHint` fields. These were removed; catalog preflight now rejects any annotation outside the standardized allowlist.
- No Git remote was configured at inspection time, and no deployment configuration was found. The public repository URL and live HTTPS app are therefore unproven external gates.
- Existing Node tests and local browser screenshots are useful engineering evidence, but they do not prove Site Tools discovery, agent selection, or invocation in either official judge environment.

## Questions that still require owner or organizer confirmation

1. Who is the eligible entrant/representative, and are there team members whose prize eligibility or media consent must be recorded?
2. Which public repository, hosting account/domain, and YouTube account should be used? Publishing, deploying, uploading, and submitting require those account-owner decisions.
3. Does Devpost intend the contradictory multiple-submission clause to mean exactly one entry per person across individual and team identities? Use one until written clarification says otherwise.
4. Does Devpost require the literal imperative API for eligibility, or is an entirely declarative WebMCP app acceptable? This repository already uses the imperative API, so no decision is needed for the current implementation.
5. The rules' optional-plugin section mistakenly names `openai.devpost.com`; use the functioning `webmcp.devpost.com` site unless the organizer says otherwise.
