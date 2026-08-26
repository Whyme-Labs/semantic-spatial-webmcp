# Deploy the static app

The production artifact is the `dist/` directory. It contains only the browser application, security headers, license, and a file-hash manifest.

## Build the artifact

```bash
npm run build
```

Run the build again before every deployment. The builder removes the prior `dist/` directory, copies the allowlisted application files, and records SHA-256 hashes in `dist/build-manifest.json`.

## Configure the host

Set the build command to `npm run build` and the publish directory to `dist`.

Cloudflare Pages and Netlify read `dist/_headers`. For another static host, configure the same response headers in that host's settings. WebMCP needs an HTTPS secure context and an origin-keyed document. Do not send `Origin-Agent-Cluster: ?0`.

The Content Security Policy allows the two pinned renderer module hosts and HTTPS splat files supplied through the optional `splat` query parameter. The checked-in demo does not need an external splat file.

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
