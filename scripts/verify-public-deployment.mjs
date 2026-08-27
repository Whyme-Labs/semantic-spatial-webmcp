#!/usr/bin/env node

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_HEADERS = Object.freeze({
  "origin-agent-cluster": "?1",
  "permissions-policy": "tools=(self)",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin"
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const options = { url: null, output: null, expectCommit: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (!["--url", "--output", "--expect-commit"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    if (argument === "--expect-commit") options.expectCommit = value;
    else options[argument.slice(2)] = value;
    index += 1;
  }
  if (!options.help && !options.url) throw new Error("--url is required.");
  return options;
}

function usage() {
  return [
    "Usage: node scripts/verify-public-deployment.mjs --url <https-url> [options]",
    "",
    "  --expect-commit <sha>  Require the deployed build manifest commit",
    "  --output <path>        Write the JSON receipt to this path",
    "  --help                 Show this help"
  ].join("\n");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function verifyDeployment(inputUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = new URL(inputUrl);
  assert(baseUrl.protocol === "https:", "The public deployment must use HTTPS.");
  baseUrl.pathname = baseUrl.pathname.endsWith("/") ? baseUrl.pathname : `${baseUrl.pathname}/`;
  baseUrl.search = "";
  baseUrl.hash = "";

  const rootResponse = await fetchImpl(baseUrl);
  assert(rootResponse.status === 200, `Root returned HTTP ${rootResponse.status}.`);
  assert(!rootResponse.headers.has("www-authenticate"), "The root unexpectedly requires authentication.");

  const verifiedHeaders = {};
  for (const [name, expected] of Object.entries(REQUIRED_HEADERS)) {
    const actual = rootResponse.headers.get(name);
    assert(actual === expected, `${name} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
    verifiedHeaders[name] = actual;
  }
  const csp = rootResponse.headers.get("content-security-policy") ?? "";
  assert(csp.includes("script-src 'self' 'sha256-"), "CSP does not hash-allow the import map.");
  assert(csp.includes("connect-src 'self' https: data:"), "CSP does not allow Spark's embedded WASM fetch.");
  assert(csp.includes("object-src 'none'"), "CSP must disable object embedding.");
  verifiedHeaders["content-security-policy"] = csp;

  const manifestUrl = new URL("build-manifest.json", baseUrl);
  const manifestResponse = await fetchImpl(manifestUrl);
  assert(manifestResponse.status === 200, `Build manifest returned HTTP ${manifestResponse.status}.`);
  const manifestText = await manifestResponse.text();
  const manifest = JSON.parse(manifestText);
  assert(manifest.schemaVersion === 1, "Build manifest schemaVersion must equal 1.");
  assert(manifest.dirty === false, "Build manifest must come from a clean worktree.");
  if (options.expectCommit) assert(manifest.commit === options.expectCommit, `Expected commit ${options.expectCommit}, got ${manifest.commit}.`);
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, "Build manifest has no files.");

  const verifiedFiles = [];
  for (const file of manifest.files) {
    assert(typeof file.path === "string" && /^[a-f0-9]{64}$/.test(file.sha256), "Build manifest contains an invalid file record.");
    if (file.path === "_headers") continue;
    const response = await fetchImpl(new URL(file.path, baseUrl));
    assert(response.status === 200, `${file.path} returned HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.byteLength === file.bytes, `${file.path} expected ${file.bytes} bytes, got ${bytes.byteLength}.`);
    assert(sha256(bytes) === file.sha256, `${file.path} SHA-256 did not match the manifest.`);
    verifiedFiles.push(file.path);
  }

  const policyFileResponse = await fetchImpl(new URL("_headers", baseUrl));
  assert(policyFileResponse.status === 404, `_headers must not be public; got HTTP ${policyFileResponse.status}.`);
  const missingResponse = await fetchImpl(new URL("__deployment-verifier-missing__", baseUrl));
  assert(missingResponse.status === 404, `Missing path expected HTTP 404, got ${missingResponse.status}.`);

  return {
    verifiedAt: new Date().toISOString(),
    url: baseUrl.href,
    https: true,
    anonymousAccess: true,
    rootStatus: rootResponse.status,
    headers: verifiedHeaders,
    manifest: {
      url: manifestUrl.href,
      sha256: sha256(manifestText),
      builtAt: manifest.builtAt,
      commit: manifest.commit,
      dirty: manifest.dirty,
      fileCount: manifest.files.length
    },
    assets: {
      verifiedCount: verifiedFiles.length,
      verifiedFiles,
      policyFile: { path: "_headers", status: policyFileResponse.status }
    },
    missingPathStatus: missingResponse.status,
    result: "passed"
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  let receipt;
  try {
    receipt = await verifyDeployment(options.url, { expectCommit: options.expectCommit });
  } catch (error) {
    receipt = {
      verifiedAt: new Date().toISOString(),
      url: options.url,
      result: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
  const encoded = `${JSON.stringify(receipt, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(options.output), encoded);
  process.stdout.write(encoded);
  if (receipt.result !== "passed") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Deployment verification failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { parseArgs };
