import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
if (output !== join(root, "dist")) throw new Error("Refusing to build outside the repository dist directory.");

const inputs = ["index.html", "styles.css", "assets", "src", "LICENSE"];
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const input of inputs) {
  cpSync(resolve(root, input), resolve(output, input), { recursive: true });
}
cpSync(resolve(root, "deployment/_headers"), resolve(output, "_headers"));

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const files = filesUnder(output)
  .filter((path) => statSync(path).isFile())
  .sort()
  .map((path) => {
    const bytes = readFileSync(path);
    return {
      path: relative(output, path),
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  });

const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
const worktree = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
const manifest = {
  schemaVersion: 1,
  builtAt: new Date().toISOString(),
  commit: git.status === 0 ? git.stdout.trim() : null,
  dirty: worktree.status !== 0 || worktree.stdout.trim() !== "",
  files
};
writeFileSync(resolve(output, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const totalBytes = files.reduce((total, file) => total + file.bytes, 0);
process.stdout.write(`Built ${files.length} files (${totalBytes} bytes) in dist/.\n`);
