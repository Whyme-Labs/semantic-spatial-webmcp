import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("wrangler.jsonc", root), "utf8"));
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

test("Cloudflare Workers deploys the allowlisted artifact through direct static assets", () => {
  assert.equal(config.name, "semantic-spatial-webmcp");
  assert.equal(config.compatibility_date, "2026-08-27");
  assert.equal(config.main, undefined);
  assert.deepEqual(config.assets, {
    directory: "./dist",
    not_found_handling: "404-page",
    run_worker_first: false
  });
  assert.equal(config.account_id, undefined);
});

test("deployment scripts build before Wrangler validates or publishes", () => {
  assert.equal(packageJson.scripts["deploy:dry-run"], "npm run build && wrangler deploy --dry-run");
  assert.equal(packageJson.scripts.deploy, "npm run build && wrangler deploy");
  assert.match(packageJson.devDependencies.wrangler, /^\^4\./);
});
