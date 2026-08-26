import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { runEvaluationSuite } from "../scripts/run-evals.mjs";

const suite = JSON.parse(readFileSync(new URL("../evals/webmcp-cases.json", import.meta.url), "utf8"));

test("deterministic prompt fixtures pass through the shared runtime", async () => {
  const receipt = await runEvaluationSuite(suite);
  assert.equal(receipt.result, "passed");
  assert.equal(receipt.failures, 0);
  assert.equal(receipt.cases, 5);
  assert.ok(receipt.assertions >= 20);
  assert.ok(receipt.caseResults.every((testCase) => testCase.calls.length > 0));
});
