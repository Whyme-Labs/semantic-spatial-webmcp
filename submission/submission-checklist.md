# Submission checklist

Complete this checklist against the final public artifacts. Do not mark an item complete from a local file or a smoke test.

## Entrant

- [x] Confirm the entrant is eligible under Official Rules section 3.
- [x] Record the individual, team, or organization name used on Devpost.
- [x] If entering as a team or organization, appoint the eligible representative. Not applicable: individual entrant with no team members.
- [x] Confirm that no conflict-of-interest or excluded-party rule applies.
- [x] Confirm ownership of the code, assets, voice, marks, screenshots, and video.

## Public application

- [x] Deploy `dist/` to a public HTTPS URL.
- [x] Confirm that no account is required.
- [x] Confirm `Origin-Agent-Cluster: ?1`.
- [x] Confirm `Permissions-Policy: tools=(self)`.
- [x] Open the app from a signed-out clean browser profile.
- [x] Run the full human-interface flow with no console errors.
- [x] Run the full WebMCP flow in an official judge environment: Chrome 151 with WebMCP testing enabled.
- Optional: repeat the flow in ChatGPT's desktop built-in browser if Site Tools access is available.
- [x] Keep the app free and available until September 21, 2026 at 5:00 PM Pacific Time. Owner attestation recorded.

## Public repository

- [x] Publish the complete Git history to GitHub, GitLab, or Bitbucket.
- [x] Confirm anonymous access.
- [x] Confirm that the host recognizes the root MIT license.
- [x] Confirm the repository contains source, tests, deployment instructions, provenance, and submission materials.
- [x] Confirm `starter-v0.1.0` and SHA `8949b3c2bb0a3bf85b33104279c57301185211c1` are present.
- [x] Run `npm run verify` from a clean clone.
- [x] Run `npm run check:submission` from a clean clone.
- [x] Confirm the public repository's **Verify release** workflow is green for the submitted commit.
- [x] Review `docs/third-party-provenance.md` against the final media.

## Demo video

- [x] Record the production URL and real WebMCP calls in the paced Chrome replay.
- [x] Use the prompts and shot list in `submission/demo-script.md`.
- [x] Include clear English narration. One continuous VoxCPM2 take passed exact-script alignment for all 12 story beats and the hum/pacing gate.
- [x] Use the aligned 24-shot edit. The final file has 14 detected cuts, 11 beat fades, and zero freeze events over two seconds.
- [x] Do not use music.
- [x] Confirm the final duration is below 3:00.
- [ ] Watch the exported video with sound.
- [ ] Publish the video as Public on YouTube.
- [ ] Open the YouTube link while signed out.

## Devpost entry

- [ ] Use the copy in `submission/submission-copy.md`.
- [ ] Add the public app URL.
- [ ] Add the public repository URL.
- [ ] Add the public YouTube URL.
- [ ] Add final screenshots from the production build.
- [ ] Add testing instructions and any credentials. No credentials are expected for this app.
- [ ] Preview the entry as a judge would see it.
- [ ] Submit before September 4, 2026 at 4:00 AM Malaysia time.
- [ ] Save the Devpost confirmation page or email.

## Final no-receipt-no-claim check

- [x] The video shows the same build as the public URL.
- [x] The public repository contains the commit that produced the deployed manifest.
- [x] Every number in the entry has a repository or browser receipt.
- [x] The entry calls the default station synthetic, never captured.
- [x] No item is marked complete because an upload or deployment was merely started.
