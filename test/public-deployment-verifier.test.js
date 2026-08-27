import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { verifyDeployment } from "../scripts/verify-public-deployment.mjs";

const rootHeaders = {
  "content-security-policy": "default-src 'self'; script-src 'self' 'sha256-example'; connect-src 'self' https: data:; object-src 'none'",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "origin-agent-cluster": "?1",
  "permissions-policy": "tools=(self)",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function deploymentFetch(overrides = {}) {
  const asset = Buffer.from("fixture app");
  const manifest = JSON.stringify({
    schemaVersion: 1,
    builtAt: "2026-08-27T00:00:00.000Z",
    commit: "abc123",
    dirty: false,
    files: [
      { path: "_headers", bytes: 10, sha256: "0".repeat(64) },
      { path: "index.html", bytes: asset.byteLength, sha256: digest(asset) }
    ]
  });
  return async (input) => {
    const url = new URL(input);
    if (url.pathname === "/") return new Response(asset, { status: 200, headers: { ...rootHeaders, ...overrides } });
    if (url.pathname === "/build-manifest.json") return new Response(manifest, { status: 200 });
    if (url.pathname === "/index.html") return new Response(asset, { status: 200 });
    return new Response("missing", { status: 404 });
  };
}

test("public deployment verifier checks headers, clean manifest, asset hashes, and 404s", async () => {
  const receipt = await verifyDeployment("https://example.com", {
    expectCommit: "abc123",
    fetchImpl: deploymentFetch()
  });
  assert.equal(receipt.result, "passed");
  assert.equal(receipt.manifest.dirty, false);
  assert.deepEqual(receipt.assets.verifiedFiles, ["index.html"]);
  assert.equal(receipt.assets.policyFile.status, 404);
  assert.equal(receipt.missingPathStatus, 404);
});

test("public deployment verifier rejects a missing WebMCP header", async () => {
  await assert.rejects(
    verifyDeployment("https://example.com", { fetchImpl: deploymentFetch({ "permissions-policy": "" }) }),
    /permissions-policy/
  );
});
