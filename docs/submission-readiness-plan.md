# Submission readiness plan

This plan turns the current local prototype into a package that a competition judge can open, understand, test, and score.

## Definition of done

The project is submission-ready only when all statements below are true.

- A public HTTPS URL loads the app without an account.
- The public repository contains the source, an OSI license, setup steps, challenge provenance, and fresh verification receipts.
- The app registers valid WebMCP tools in an official judge browser.
- A judge can complete the route, outage, alternate-route, evidence-warning, recapture, and undo flow from a fresh session.
- The submission folder contains final English copy, screenshots, a video script shorter than three minutes, and every required link or field.
- The recorded demo shows the real public build and real WebMCP calls.
- No artifact claims that the synthetic station is a captured site.

## Scope and rigor

This run has six workstreams. The repository work is reversible. Public deployment, repository publication, video upload, and final submission affect external accounts, so those actions require the account owner.

The rigor level is high. The challenge has a fixed deadline, public judging, and equal scoring across WebMCP use, execution, impact, and creativity. Each phase ends with a runnable check or a reviewable artifact.

## Throughput checkpoint

- Blocking first steps. Recheck the official rules and build one requirement matrix before changing the product.
- Independent workstreams. Rules research can run while the main thread audits the repository. Product code, submission copy, and media assets use separate files.
- Shared mutable state. One owner edits the app at a time. Research writes only `docs/submission-requirements-research.md`.
- Smallest safe decomposition. Use one implementation owner for each product increment because `src/app.js`, the renderer, styles, and browser verification share runtime state.

## Phase 1. Establish the gates

1. Recheck the official challenge page, Devpost rules, and current OpenAI Site Tools documentation.
2. Convert every requirement into `docs/submission-readiness.json`.
3. Add a verifier that fails when a required repository artifact or unresolved placeholder is missing.
4. Record the baseline in `.audit/webmcp-submission.tsv`.

Exit condition: one command reports each gate as passed, failed, or external.

## Phase 2. Finish the judged product path

1. Test actual WebMCP registration in an official judge browser.
2. Add a guided demo control that runs the complete multi-tool story without hidden state.
3. Add visible scenario history and a clear review state for writes.
4. Add recapture camera markers and navigation.
5. Add error, loading, reduced-motion, keyboard, and narrow-screen behavior.
6. Add deterministic evaluation cases for tool outputs and state transitions.

Exit condition: a fresh browser completes the full story twice, once through the UI and once through WebMCP.

## Phase 3. Prepare the public build

1. Remove runtime CDN dependencies or pin and vendor them if the license permits.
2. Add production headers, caching rules, content security policy, and a deployment configuration.
3. Measure load size and first meaningful render on a clean connection.
4. Add a public-build smoke test.

Exit condition: the production build loads over HTTPS with no console errors and no private services.

## Phase 4. Prepare the submission package

1. Write the final project description and short summary.
2. Create final screenshots from the production build.
3. Write a 165 to 175 second narration and shot list.
4. Add a recording checklist and exact demo prompts.
5. Fill a submission checklist with the public app, repository, license, and video links.

Exit condition: `submission/` contains every field and media artifact except links that require the owner's accounts.

## Phase 5. Completion audit

1. Run the repository verifier.
2. Run all deterministic tests.
3. Test the public app from a fresh browser profile.
4. Test WebMCP in at least one supported judge browser.
5. Compare the final package with every official requirement.
6. Review the decision trail against the actual work.

Exit condition: every gate is verified or names one external owner action. An uncertain gate fails.

## Decisions reserved for the owner

These choices cannot be inferred from the repository.

- The eligible entrant name and team members.
- The YouTube account used for the public video.
- Permission to upload the video and submit the final Devpost entry.
