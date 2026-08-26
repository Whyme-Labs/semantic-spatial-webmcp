import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { evaluateRegistry, parseRegistryText } from "../scripts/check-submission.mjs";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/check-submission.mjs");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "submission-readiness-"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "README.md"), "ready marker\n");
  writeFileSync(join(root, "docs/receipt.json"), '{"result":"passed","failures":0}\n');
  return root;
}

function registry(gates) {
  return { schemaVersion: 1, gates };
}

function repositoryGate(assertions) {
  return {
    id: "repository-ready",
    category: "quality",
    requirement: "Repository evidence passes.",
    evidenceClass: "repository",
    assertions
  };
}

function writeRegistry(root, value) {
  const path = join(root, "registry.json");
  writeFileSync(path, `${JSON.stringify(value)}\n`);
  return path;
}

function runCli(root, value, ...args) {
  const registryPath = writeRegistry(root, value);
  return spawnSync(process.execPath, [script, "--root", root, "--registry", registryPath, ...args], {
    encoding: "utf8"
  });
}

test("repository file, content, and JSON assertions pass", () => {
  const root = fixture();
  const parsed = parseRegistryText(JSON.stringify(registry([
    repositoryGate([
      { type: "fileExists", path: "README.md" },
      { type: "fileContains", path: "README.md", contains: "ready marker" },
      { type: "fileNotContains", path: "README.md", contains: "placeholder" },
      { type: "jsonValue", path: "docs/receipt.json", pointer: "/result", equals: "passed" },
      { type: "jsonValue", path: "docs/receipt.json", pointer: "/failures", equals: 0 },
      { type: "jsonNumberAtLeast", path: "docs/receipt.json", pointer: "/failures", minimum: 0 }
    ])
  ])));

  const report = evaluateRegistry(parsed, root);
  assert.deepEqual(report.summary, { PASS: 1, FAIL: 0, EXTERNAL: 0 });
  assert.equal(report.gates[0].status, "PASS");
});

test("missing files and missing required content fail deterministically", () => {
  const root = fixture();
  const result = runCli(root, registry([
    repositoryGate([
      { type: "fileExists", path: "missing.md" },
      { type: "fileContains", path: "README.md", contains: "absent marker" }
    ])
  ]));

  assert.equal(result.status, 1);
  assert.match(result.stdout, /^FAIL\s+repository-ready/m);
  assert.match(result.stdout, /missing file: missing\.md/);
  assert.match(result.stdout, /expected to contain "absent marker"/);
});

test("malformed registries are rejected at the parse boundary", () => {
  assert.throws(
    () => parseRegistryText(JSON.stringify({ schemaVersion: 1, gates: [{ status: "PASS" }] }), "fixture"),
    /unknown field\(s\): status/
  );
  assert.throws(() => parseRegistryText("{", "fixture"), /fixture: invalid JSON/);
});

test("external gates report EXTERNAL without failing default mode", () => {
  const root = fixture();
  const result = runCli(root, registry([{
    id: "publish-demo",
    category: "demo",
    requirement: "The demo is public.",
    evidenceClass: "external",
    assertions: [],
    ownerAction: "Publish the approved video."
  }]), "--json");

  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.summary, { PASS: 0, FAIL: 0, EXTERNAL: 1 });
  assert.equal(report.gates[0].status, "EXTERNAL");
  assert.equal(report.gates[0].ownerAction, "Publish the approved video.");
});

test("strict mode fails when any external gate remains", () => {
  const root = fixture();
  const result = runCli(root, registry([{
    id: "publish-demo",
    category: "demo",
    requirement: "The demo is public.",
    evidenceClass: "external",
    assertions: [],
    ownerAction: "Publish the approved video."
  }]), "--strict");

  assert.equal(result.status, 1);
  assert.match(result.stdout, /^EXTERNAL\s+publish-demo/m);
});
