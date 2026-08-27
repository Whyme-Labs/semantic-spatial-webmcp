import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("SceneIndex is the visible product identity", () => {
  const page = read("index.html");
  const submission = read("submission/submission-copy.md");
  const narration = JSON.parse(read("submission/narration-script.json"));

  assert.match(page, /<title>SceneIndex \| Semantic spatial browser<\/title>/);
  assert.match(page, /<h1>SceneIndex<\/h1>/);
  assert.match(page, /assets\/brand\/mark-inverse\.svg/);
  assert.match(page, /assets\/brand\/app-icon\.svg/);
  assert.match(submission, /^# SceneIndex$/m);
  assert.match(narration.segments[0].text, /This is SceneIndex\./);
  assert.doesNotMatch(narration.segments[0].text, /Semantic Spatial Browser/);
});

test("the production palette and SVG system match the approved brand board", () => {
  const styles = read("styles.css");
  const mark = read("assets/brand/mark.svg");
  const inverse = read("assets/brand/mark-inverse.svg");
  const icon = read("assets/brand/app-icon.svg");

  for (const color of ["#111418", "#0D4D57", "#F2F4F6", "#8A8F98", "#FAFBFC"]) {
    assert.match(styles, new RegExp(color, "i"));
  }
  assert.match(mark, /id="mark-path"/);
  assert.match(mark, /id="node"/);
  assert.match(mark, /pathLength="1"/);
  assert.match(mark, /mask="url\(#node-cutout\)"/);
  assert.match(inverse, /stroke="#FAFBFC"/);
  assert.match(icon, /fill="#0D4D57"/);
});

test("the deployment build includes the brand assets", () => {
  const build = read("scripts/build.mjs");
  assert.match(build, /const inputs = \["index\.html", "styles\.css", "assets", "src", "LICENSE"\]/);
});

test("the brand manifest binds each production SVG and records passing QA", () => {
  const manifest = JSON.parse(read("docs/brand/brand-manifest.json"));
  assert.equal(manifest.brand, "SceneIndex");
  assert.equal(manifest.vectorQa.fitIou, 0.8485);
  assert.ok(manifest.vectorQa.pathSegments <= manifest.vectorQa.segmentBudget);
  assert.equal(manifest.motionQa.finalFrameAbsoluteErrorPixels, 0);
  assert.equal(manifest.motionQa.result, "passed");
  assert.ok(manifest.contrast.every(({ ratio }) => ratio >= 4.5));

  for (const asset of manifest.assets) {
    const bytes = readFileSync(new URL(`../${asset.path}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, asset.path);
  }
});
