import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { demoScene } from "../src/demo-scene.js";
import { SpatialSceneStore } from "../src/scene-store.js";
import { SpatialToolRuntime } from "../src/tool-runtime.js";
import { MemoryViewerAdapter } from "../src/viewer-adapter.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultCasesPath = resolve(projectRoot, "evals/webmcp-cases.json");
const defaultOutputPath = resolve(projectRoot, "docs/evaluation-results.json");

function valueAtPointer(value, pointer) {
  if (pointer === "") return value;
  let current = value;
  for (const rawToken of pointer.slice(1).split("/")) {
    const token = rawToken.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!current || typeof current !== "object" || !Object.hasOwn(current, token)) {
      throw new Error(`Missing result pointer ${pointer}.`);
    }
    current = current[token];
  }
  return current;
}

function assertExpectation(result, expectation) {
  const actual = valueAtPointer(result, expectation.pointer);
  if (Object.hasOwn(expectation, "equals") && !isDeepStrictEqual(actual, expectation.equals)) {
    throw new Error(`${expectation.pointer} expected ${JSON.stringify(expectation.equals)}, got ${JSON.stringify(actual)}.`);
  }
  if (Object.hasOwn(expectation, "includes") && (!Array.isArray(actual) || !actual.includes(expectation.includes))) {
    throw new Error(`${expectation.pointer} did not include ${JSON.stringify(expectation.includes)}.`);
  }
  if (Object.hasOwn(expectation, "length") && actual?.length !== expectation.length) {
    throw new Error(`${expectation.pointer} expected length ${expectation.length}, got ${actual?.length}.`);
  }
  if (Object.hasOwn(expectation, "atLeast") && (typeof actual !== "number" || actual < expectation.atLeast)) {
    throw new Error(`${expectation.pointer} expected at least ${expectation.atLeast}, got ${JSON.stringify(actual)}.`);
  }
}

function validateSuite(suite) {
  if (suite?.schemaVersion !== 1 || !Array.isArray(suite.cases) || suite.cases.length === 0) {
    throw new Error("The evaluation suite must use schemaVersion 1 and contain cases.");
  }
  const ids = new Set();
  for (const testCase of suite.cases) {
    if (!testCase.id || ids.has(testCase.id)) throw new Error(`Invalid or duplicate case id: ${testCase.id}.`);
    ids.add(testCase.id);
    if (!testCase.prompt || !Array.isArray(testCase.steps) || testCase.steps.length === 0) {
      throw new Error(`${testCase.id} must contain a prompt and steps.`);
    }
    const actualCalls = testCase.steps.map((step) => step.tool);
    if (!isDeepStrictEqual(actualCalls, testCase.expectedCalls)) {
      throw new Error(`${testCase.id} expectedCalls must match its executable steps.`);
    }
  }
}

export async function runEvaluationSuite(suite) {
  validateSuite(suite);
  const caseResults = [];

  for (const testCase of suite.cases) {
    const store = new SpatialSceneStore(demoScene);
    const viewer = new MemoryViewerAdapter();
    const runtime = new SpatialToolRuntime(store, viewer);
    let assertionCount = 0;

    try {
      for (const step of testCase.steps) {
        if (step.expectErrorContains) {
          let error;
          try {
            await runtime.invoke(step.tool, step.args, { source: "evaluation" });
          } catch (caught) {
            error = caught;
          }
          if (!String(error?.message ?? error).includes(step.expectErrorContains)) {
            throw new Error(`${step.tool} did not reject with ${JSON.stringify(step.expectErrorContains)}.`);
          }
          assertionCount += 1;
          continue;
        }

        const result = await runtime.invoke(step.tool, step.args, { source: "evaluation" });
        for (const expectation of step.assert ?? []) {
          assertExpectation(result, expectation);
          assertionCount += 1;
        }
      }
      caseResults.push({ id: testCase.id, prompt: testCase.prompt, calls: testCase.expectedCalls, assertionCount, result: "passed" });
    } catch (error) {
      caseResults.push({
        id: testCase.id,
        prompt: testCase.prompt,
        calls: testCase.expectedCalls,
        assertionCount,
        result: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const failures = caseResults.filter((testCase) => testCase.result === "failed").length;
  return {
    verifiedAt: new Date().toISOString(),
    evidenceClass: "deterministic-runtime",
    note: "These cases verify expected tool plans and grounded runtime behavior. They do not claim that a language model selected the calls.",
    cases: caseResults.length,
    assertions: caseResults.reduce((sum, testCase) => sum + testCase.assertionCount, 0),
    failures,
    result: failures === 0 ? "passed" : "failed",
    caseResults
  };
}

async function main() {
  const suite = JSON.parse(readFileSync(defaultCasesPath, "utf8"));
  const receipt = await runEvaluationSuite(suite);
  const output = `${JSON.stringify(receipt, null, 2)}\n`;
  writeFileSync(defaultOutputPath, output);
  process.stdout.write(output);
  if (receipt.failures > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Evaluation failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
