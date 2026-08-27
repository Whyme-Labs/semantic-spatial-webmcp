# Deploy the static app

The production artifact is the `dist/` directory. It contains only the browser application, security headers, license, and a file-hash manifest.

## Build the artifact

```bash
npm run build
```

Run the build again before every deployment. The builder removes the prior `dist/` directory, copies the allowlisted application files, and records SHA-256 hashes in `dist/build-manifest.json`.

## Deploy to Cloudflare Workers

The checked-in `wrangler.jsonc` deploys `dist/` with Workers Static Assets. It intentionally has no Worker script and sets `run_worker_first` to `false`, so Cloudflare serves assets directly from its nearest asset location.

```bash
npm ci
npm run deploy:dry-run
npm run deploy
```

Cloudflare parses `dist/_headers` and applies its rules to static asset responses. WebMCP needs the resulting HTTPS secure context and origin-keyed document. Do not send `Origin-Agent-Cluster: ?0`.

The CSP allowlists the inline import map by its SHA-256 hash. `test/cloudflare-workers.test.js` recalculates that hash from `index.html`; changing the import map without updating the policy fails the test instead of silently disabling the 3D renderer.

Spark 2.1.0 embeds its WASM as a `data:application/wasm` URL and initializes it with `fetch()`. The policy therefore permits `data:` only in `connect-src`; scripts still cannot execute from arbitrary inline or data URLs.

The Content Security Policy allows the two pinned renderer module hosts and HTTPS splat files supplied through the optional `splat` query parameter. The checked-in demo does not need an external splat file. No Cloudflare account ID or credential is stored in the repository.

## Verify the public deployment

Replace the example URL and run:

```bash
curl -sSI https://example.com/ | rg -i 'origin-agent-cluster|permissions-policy|content-security-policy|x-content-type-options'
curl -sS https://example.com/build-manifest.json
```

Confirm these results:

- `Origin-Agent-Cluster` is `?1`.
- `Permissions-Policy` contains `tools=(self)`.
- The page loads without console errors in a fresh browser profile.
- The 2D map works when site tools or WebGL are unavailable.
- Site tools register in ChatGPT's browser and Chrome 149 or later with WebMCP testing enabled.

Keep the deployment public and free to access until the judging period ends on September 21, 2026 at 5:00 PM Pacific Time.
