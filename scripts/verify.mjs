import { readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env
  });
  return {
    command: [command, ...args].join(" "),
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

const javascriptFiles = ["src", "test", "scripts"]
  .flatMap((directory) => readdirSync(resolve(projectRoot, directory))
    .filter((name) => name.endsWith(".js") || name.endsWith(".mjs"))
    .map((name) => `${directory}/${name}`));

const syntaxRuns = javascriptFiles.map((file) => run(process.execPath, ["--check", file]));
const syntax = {
  status: syntaxRuns.some((result) => result.status !== 0) ? 1 : 0,
  stdout: syntaxRuns.map((result) => result.stdout).join(""),
  stderr: syntaxRuns.map((result) => result.stderr).join("")
};

if (process.argv.includes("--syntax-only")) {
  if (syntax.stdout) process.stdout.write(syntax.stdout);
  if (syntax.stderr) process.stderr.write(syntax.stderr);
  process.exit(syntax.status);
}

const tests = run(process.execPath, ["--test"]);
const combinedTestOutput = `${tests.stdout}${tests.stderr}`;
const testCount = Number(combinedTestOutput.match(/^# tests (\d+)$/m)?.[1] ?? 0);
const failureCount = Number(combinedTestOutput.match(/^# fail (\d+)$/m)?.[1] ?? 0);
const passed = tests.status === 0 && syntax.status === 0 && failureCount === 0;

writeFileSync(resolve(projectRoot, "docs/test-results.txt"), combinedTestOutput);
writeFileSync(resolve(projectRoot, "docs/build-verification.json"), `${JSON.stringify({
  verifiedAt: new Date().toISOString(),
  nodeVersion: process.version,
  nodeSyntaxCheck: syntax.status === 0 ? "passed" : "failed",
  syntaxFiles: javascriptFiles.length,
  tests: testCount,
  failures: failureCount,
  result: passed ? "passed" : "failed"
}, null, 2)}\n`);

process.stdout.write(combinedTestOutput);
if (syntax.stderr) process.stderr.write(syntax.stderr);
if (!passed) process.exit(1);
