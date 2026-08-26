# Submission checklist

Complete this checklist against the final public artifacts. Do not mark an item complete from a local file or a smoke test.

## Entrant

- [ ] Confirm the entrant is eligible under Official Rules section 3.
- [ ] Record the individual, team, or organization name used on Devpost.
- [ ] If entering as a team or organization, appoint the eligible representative.
- [ ] Confirm that no conflict-of-interest or excluded-party rule applies.
- [ ] Confirm ownership of the code, assets, voice, marks, screenshots, and video.

## Public application

- [ ] Deploy `dist/` to a public HTTPS URL.
- [ ] Confirm that no account is required.
- [ ] Confirm `Origin-Agent-Cluster: ?1`.
- [ ] Confirm `Permissions-Policy: tools=(self)`.
- [ ] Open the app from a signed-out clean browser profile.
- [ ] Run the full human-interface flow with no console errors.
- [ ] Run the full Site Tools flow in ChatGPT's in-app browser.
- [ ] Run tool discovery and execution in Chrome 149 or later with WebMCP testing enabled.
- [ ] Keep the app free and available until September 21, 2026 at 5:00 PM Pacific Time.

## Public repository

- [ ] Publish the complete Git history to GitHub, GitLab, or Bitbucket.
- [ ] Confirm anonymous access.
- [ ] Confirm that the host recognizes the root MIT license.
- [ ] Confirm the repository contains source, tests, deployment instructions, provenance, and submission materials.
- [ ] Confirm `starter-v0.1.0` and SHA `8949b3c2bb0a3bf85b33104279c57301185211c1` are present.
- [ ] Run `npm run verify` from a clean clone.
- [ ] Run `npm run check:submission` from a clean clone.
- [ ] Confirm the public repository's **Verify release** workflow is green for the submitted commit.
- [ ] Review `docs/third-party-provenance.md` against the final media.

## Demo video

- [ ] Record the production URL and real Site Tools calls.
- [ ] Use the prompts and shot list in `submission/demo-script.md`.
- [ ] Include clear English narration.
- [ ] Do not use music.
- [ ] Confirm the final duration is below 3:00.
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

- [ ] The video shows the same build as the public URL.
- [ ] The public repository contains the commit that produced the deployed manifest.
- [ ] Every number in the entry has a repository or browser receipt.
- [ ] The entry calls the default station synthetic, never captured.
- [ ] No item is marked complete because an upload or deployment was merely started.
