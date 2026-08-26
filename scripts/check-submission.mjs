import { existsSync, readFileSync, statSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE_CLASSES = new Set(["repository", "runtime", "external"]);
const ASSERTION_KEYS = {
  fileExists: new Set(["type", "path"]),
  fileContains: new Set(["type", "path", "contains"]),
  fileNotContains: new Set(["type", "path", "contains"]),
  jsonValue: new Set(["type", "path", "pointer", "equals"]),
  jsonNumberAtLeast: new Set(["type", "path", "pointer", "minimum"])
};

function fail(source, message) {
  throw new Error(`${source}: ${message}`);
}

function assertObject(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(source, "must be an object");
  }
}

function rejectUnknownKeys(value, allowed, source) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) fail(source, `unknown field(s): ${unknown.join(", ")}`);
}

function validateText(value, source) {
  if (typeof value !== "string" || value.trim() === "") fail(source, "must be a non-empty string");
}

function validatePath(value, source) {
  validateText(value, source);
  if (isAbsolute(value) || value.split(/[\\/]/).includes("..")) {
    fail(source, "must be a repository-relative path without '..'");
  }
}

function validateAssertion(assertion, source) {
  assertObject(assertion, source);
  validateText(assertion.type, `${source}.type`);
  const allowed = ASSERTION_KEYS[assertion.type];
  if (!allowed) fail(`${source}.type`, `unsupported assertion type '${assertion.type}'`);
  rejectUnknownKeys(assertion, allowed, source);
  validatePath(assertion.path, `${source}.path`);

  if (assertion.type === "fileContains" || assertion.type === "fileNotContains") {
    validateText(assertion.contains, `${source}.contains`);
  }
  if (assertion.type === "jsonValue" || assertion.type === "jsonNumberAtLeast") {
    if (typeof assertion.pointer !== "string" || (assertion.pointer !== "" && !assertion.pointer.startsWith("/"))) {
      fail(`${source}.pointer`, "must be an empty string or a JSON Pointer beginning with '/'");
    }
  }
  if (assertion.type === "jsonValue") {
    if (!Object.hasOwn(assertion, "equals")) fail(source, "must include equals");
  }
  if (assertion.type === "jsonNumberAtLeast" && (typeof assertion.minimum !== "number" || !Number.isFinite(assertion.minimum))) {
    fail(`${source}.minimum`, "must be a finite number");
  }
}

export function parseRegistryText(text, source = "submission registry") {
  let registry;
  try {
    registry = JSON.parse(text);
  } catch (error) {
    fail(source, `invalid JSON (${error.message})`);
  }

  assertObject(registry, source);
  rejectUnknownKeys(registry, new Set(["schemaVersion", "gates"]), source);
  if (registry.schemaVersion !== 1) fail(`${source}.schemaVersion`, "must equal 1");
  if (!Array.isArray(registry.gates) || registry.gates.length === 0) {
    fail(`${source}.gates`, "must be a non-empty array");
  }

  const ids = new Set();
  registry.gates.forEach((gate, index) => {
    const gateSource = `${source}.gates[${index}]`;
    assertObject(gate, gateSource);
    rejectUnknownKeys(gate, new Set([
      "id", "category", "requirement", "evidenceClass", "assertions", "ownerAction"
    ]), gateSource);
    validateText(gate.id, `${gateSource}.id`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gate.id)) {
      fail(`${gateSource}.id`, "must use lower-case kebab-case");
    }
    if (ids.has(gate.id)) fail(`${gateSource}.id`, `duplicate id '${gate.id}'`);
    ids.add(gate.id);
    validateText(gate.category, `${gateSource}.category`);
    validateText(gate.requirement, `${gateSource}.requirement`);
    if (!EVIDENCE_CLASSES.has(gate.evidenceClass)) {
      fail(`${gateSource}.evidenceClass`, "must be repository, runtime, or external");
    }

    if (gate.evidenceClass === "external") {
      if (!Array.isArray(gate.assertions) || gate.assertions.length !== 0) {
        fail(`${gateSource}.assertions`, "must be an empty array for external gates");
      }
      validateText(gate.ownerAction, `${gateSource}.ownerAction`);
    } else {
      if (!Array.isArray(gate.assertions) || gate.assertions.length === 0) {
        fail(`${gateSource}.assertions`, "must be a non-empty array");
      }
      if (Object.hasOwn(gate, "ownerAction")) {
        fail(`${gateSource}.ownerAction`, "is only valid for external gates");
      }
      gate.assertions.forEach((assertion, assertionIndex) => {
        validateAssertion(assertion, `${gateSource}.assertions[${assertionIndex}]`);
      });
    }
  });

  return registry;
}

function repositoryPath(root, path) {
  const target = resolve(root, path);
  const fromRoot = relative(root, target);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) throw new Error(`path escapes repository root: ${path}`);
  return target;
}

function jsonPointer(value, pointer) {
  if (pointer === "") return { found: true, value };
  let current = value;
  for (const rawToken of pointer.slice(1).split("/")) {
    const token = rawToken.replace(/~1/g, "/").replace(/~0/g, "~");
    if ((typeof current !== "object" || current === null) || !Object.hasOwn(current, token)) {
      return { found: false };
    }
    current = current[token];
  }
  return { found: true, value: current };
}

function evaluateAssertion(assertion, root) {
  const path = repositoryPath(root, assertion.path);
  if (assertion.type === "fileExists") {
    const passed = existsSync(path) && statSync(path).isFile();
    return { passed, detail: passed ? assertion.path : `missing file: ${assertion.path}` };
  }

  if (!existsSync(path)) return { passed: false, detail: `missing file: ${assertion.path}` };
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    return { passed: false, detail: `cannot read ${assertion.path}: ${error.message}` };
  }

  if (assertion.type === "fileContains" || assertion.type === "fileNotContains") {
    const found = content.includes(assertion.contains);
    const passed = assertion.type === "fileContains" ? found : !found;
    const expectation = assertion.type === "fileContains" ? "contain" : "exclude";
    return {
      passed,
      detail: passed ? `${assertion.path}: ${expectation} check passed` : `${assertion.path}: expected to ${expectation} ${JSON.stringify(assertion.contains)}`
    };
  }

  let value;
  try {
    value = JSON.parse(content);
  } catch (error) {
    return { passed: false, detail: `${assertion.path}: invalid JSON (${error.message})` };
  }
  const actual = jsonPointer(value, assertion.pointer);
  const passed = assertion.type === "jsonValue"
    ? actual.found && isDeepStrictEqual(actual.value, assertion.equals)
    : actual.found && typeof actual.value === "number" && actual.value >= assertion.minimum;
  const expected = assertion.type === "jsonValue"
    ? JSON.stringify(assertion.equals)
    : `a number >= ${assertion.minimum}`;
  return {
    passed,
    detail: passed
      ? `${assertion.path}${assertion.pointer}: value matched`
      : `${assertion.path}${assertion.pointer}: expected ${expected}, got ${actual.found ? JSON.stringify(actual.value) : "<missing>"}`
  };
}

export function evaluateRegistry(registry, root) {
  const gates = registry.gates.map((gate) => {
    if (gate.evidenceClass === "external") {
      return { ...gate, assertions: [], status: "EXTERNAL" };
    }
    const assertions = gate.assertions.map((assertion) => ({
      ...assertion,
      ...evaluateAssertion(assertion, root)
    }));
    return { ...gate, assertions, status: assertions.every(({ passed }) => passed) ? "PASS" : "FAIL" };
  });
  const summary = { PASS: 0, FAIL: 0, EXTERNAL: 0 };
  gates.forEach(({ status }) => { summary[status] += 1; });
  return { schemaVersion: registry.schemaVersion, gates, summary };
}

export function formatReport(report) {
  const lines = report.gates.map((gate) => {
    const suffix = gate.status === "FAIL"
      ? ` — ${[...new Set(gate.assertions.filter(({ passed }) => !passed).map(({ detail }) => detail))].join("; ")}`
      : gate.status === "EXTERNAL" ? ` — ${gate.ownerAction}` : "";
    return `${gate.status.padEnd(8)} ${gate.id}${suffix}`;
  });
  lines.push(`Summary: ${report.summary.PASS} PASS, ${report.summary.FAIL} FAIL, ${report.summary.EXTERNAL} EXTERNAL`);
  return `${lines.join("\n")}\n`;
}

function parseArguments(args) {
  const options = {
    registry: resolve(SCRIPT_ROOT, "docs/submission-readiness.json"),
    root: SCRIPT_ROOT,
    json: false,
    strict: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--strict") options.strict = true;
    else if (argument === "--registry" || argument === "--root") {
      const value = args[index + 1];
      if (!value) throw new Error(`${argument} requires a path`);
      options[argument.slice(2)] = resolve(value);
      index += 1;
    } else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

export function run(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  const text = readFileSync(options.registry, "utf8");
  const registry = parseRegistryText(text, options.registry);
  const report = evaluateRegistry(registry, options.root);
  process.stdout.write(options.json ? `${JSON.stringify({ ...report, strict: options.strict }, null, 2)}\n` : formatReport(report));
  return report.summary.FAIL > 0 || (options.strict && report.summary.EXTERNAL > 0) ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.exitCode = run();
  } catch (error) {
    process.stderr.write(`Submission registry error: ${error.message}\n`);
    process.exitCode = 2;
  }
}
