#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "http://127.0.0.1:4173";
const MACOS_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WAIT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;

function parseArgs(argv) {
  const options = { url: DEFAULT_URL, chrome: null, output: null, screenshot: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (!["--url", "--chrome", "--output", "--screenshot"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    options[argument.slice(2)] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return [
    "Usage: node scripts/verify-webmcp-chrome.mjs [options]",
    "",
    `  --url <url>          Page to verify (default: ${DEFAULT_URL})`,
    "  --chrome <path>      Chrome executable (auto-detected on macOS)",
    "  --output <path>      Write the JSON receipt to this path",
    "  --screenshot <path>  Capture the final page as PNG",
    "  --help               Show this help"
  ].join("\n");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function freeLocalPort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

async function waitForJson(url, description, timeoutMs = WAIT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await delay(POLL_INTERVAL_MS);
  }
  const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${description}${detail}`);
}

async function readBuildArtifact(pageUrl) {
  const manifestUrl = new URL("build-manifest.json", pageUrl).href;
  const response = await fetch(manifestUrl);
  assert(response.ok, `Build manifest request failed: ${response.status} ${response.statusText}.`);
  const text = await response.text();
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw new Error(`Build manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  assert(manifest.schemaVersion === 1, "Build manifest schemaVersion must equal 1.");
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, "Build manifest has no files.");
  const paths = new Set(manifest.files.map((file) => file.path));
  for (const required of ["LICENSE", "_headers", "index.html", "styles.css", "src/app.js"]) {
    assert(paths.has(required), `Build manifest is missing ${required}.`);
  }
  assert(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)), "Build manifest contains an invalid SHA-256 value.");
  return {
    kind: "allowlisted-dist",
    manifestUrl,
    manifestSha256: createHash("sha256").update(text).digest("hex"),
    builtAt: manifest.builtAt,
    commit: manifest.commit,
    dirty: manifest.dirty,
    fileCount: manifest.files.length
  };
}

class DevToolsConnection {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(webSocketUrl);
    this.ready = new Promise((resolveReady, rejectReady) => {
      this.socket.addEventListener("open", resolveReady, { once: true });
      this.socket.addEventListener("error", () => rejectReady(new Error("The DevTools WebSocket failed to open.")), { once: true });
    });
    this.socket.addEventListener("message", (event) => this.onMessage(event.data));
    this.socket.addEventListener("close", () => {
      for (const { reject } of this.pending.values()) reject(new Error("The DevTools WebSocket closed."));
      this.pending.clear();
    });
  }

  onMessage(payload) {
    const message = JSON.parse(String(payload));
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`CDP ${pending.method} failed: ${message.error.message}`));
      else pending.resolve(message.result ?? {});
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolveCommand, rejectCommand) => {
      this.pending.set(id, { method, resolve: resolveCommand, reject: rejectCommand });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
  }
}

async function waitForPage(connection) {
  const expression = `(() => {
    const demo = globalThis.window?.spatialDemo;
    if (!demo || demo.webmcp === null) return null;
    return {
      registered: demo.webmcp.registered,
      count: demo.webmcp.count,
      names: demo.webmcp.names,
      statusText: document.querySelector('#webmcp-status')?.textContent ?? ''
    };
  })()`;
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await connection.send("Runtime.evaluate", {
      expression,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    if (result.result?.value) return result.result.value;
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error("Timed out waiting for window.spatialDemo.webmcp to reach a final status.");
}

async function evaluateFlow(connection) {
  const expression = `(async () => {
    const fail = (message) => { throw new Error(message); };
    const check = (condition, message) => { if (!condition) fail(message); };
    const modelContext = document.modelContext;
    check(modelContext && typeof modelContext.getTools === 'function', 'document.modelContext.getTools() is unavailable.');
    check(typeof modelContext.executeTool === 'function', 'document.modelContext.executeTool() is unavailable.');

    const tools = await Promise.resolve(modelContext.getTools());
    check(Array.isArray(tools), 'document.modelContext.getTools() did not return an array.');
    check(tools.length === 10, 'Expected exactly 10 WebMCP tools; found ' + tools.length + '.');

    const normalizeResult = (value) => {
      if (typeof value !== 'string') return value;
      try { return JSON.parse(value); } catch { return value; }
    };
    const execute = async (name, args) => {
      const tool = tools.find((candidate) => candidate.name === name);
      check(tool, 'Missing WebMCP tool: ' + name + '.');
      return normalizeResult(await modelContext.executeTool(tool, JSON.stringify(args)));
    };

    const baseline = await execute('get_scene_context', {});
    check(baseline.stagedChangeCount === 0, 'Baseline context has ' + baseline.stagedChangeCount + ' staged changes. Raw result: ' + JSON.stringify(baseline));

    const navigation = await execute('navigate_to_entity', {
      entityId: 'accessible_gate_1',
      animate: false
    });
    check(navigation.found === true, 'Accessible fare gate navigation failed.');
    check(navigation.entity?.id === 'accessible_gate_1', 'Navigation selected the wrong entity.');
    check(navigation.selectedViewId === 'view_accessible_gate_1', 'Navigation did not use the named accessible-gate evidence view.');
    const navigatedContext = await execute('get_scene_context', {});
    const expectedPosition = [-3.708, 1.67, 2.76];
    const expectedTarget = [-1.98, 0.82, 0.36];
    const near = (actual, expected) => Array.isArray(actual) && actual.length === expected.length
      && actual.every((value, index) => Math.abs(value - expected[index]) < 0.002);
    check(near(navigatedContext.cameraPose?.position, expectedPosition), 'The camera did not move to the named evidence-view position.');
    check(near(navigatedContext.cameraPose?.target, expectedTarget), 'The camera did not face the named evidence-view target.');
    check(navigatedContext.selectedEntity?.id === 'accessible_gate_1', 'Scene context did not preserve the navigated selection.');
    check(navigatedContext.currentRegion === null, 'The camera is outside a semantic zone, so currentRegion must be null rather than stale.');
    check(navigatedContext.nearbyHiddenEntities?.some((entity) => entity.id === 'ticket_machine_1'), 'Scene context omitted a nearby hidden ticketing entity.');
    check(navigatedContext.connectedSpaces?.some((region) => region.id === 'west_corridor'), 'Scene context omitted a connected route space.');

    const initialRoute = await execute('find_semantic_route', {
      from: 'Entrance A',
      to: 'Platform 2',
      accessibleOnly: true
    });
    check(initialRoute.found === true, 'The initial accessible route was not found.');
    check(initialRoute.entityIds.includes('lift_1'), 'The initial route does not use Lift 1.');
    check(!initialRoute.entityIds.includes('lift_2'), 'The initial route unexpectedly uses Lift 2.');

    const closure = await execute('set_entity_state', {
      entityId: 'lift_1',
      patch: { operational: 'closed' }
    });
    check(closure.staged === true, 'Closing Lift 1 was not staged.');
    check(closure.change?.after?.operational === 'closed', 'Lift 1 did not become closed.');
    check(closure.stagedChangeCount === 1, 'Closing Lift 1 did not create exactly one staged change.');

    const alternateRoute = await execute('find_semantic_route', {
      from: 'Entrance A',
      to: 'Platform 2',
      accessibleOnly: true
    });
    check(alternateRoute.found === true, 'The alternate accessible route was not found.');
    check(alternateRoute.entityIds.includes('lift_2'), 'The alternate route does not use Lift 2.');
    check(!alternateRoute.entityIds.includes('lift_1'), 'The alternate route still uses closed Lift 1.');
    const westWarning = alternateRoute.warnings.find((warning) => warning.regionId === 'west_corridor');
    check(westWarning, 'The alternate route has no west_corridor warning.');
    check(westWarning.readiness === 0.56, 'The west_corridor route warning readiness is not 0.56.');

    const quality = await execute('get_region_quality', { regionId: 'west_corridor' });
    check(quality.found === true, 'west_corridor quality was not found.');
    check(quality.quality?.readiness?.accessibleWayfinding === 0.56, 'Accessible-wayfinding readiness is not 0.56.');
    check(quality.quality?.recommendations?.length === 2, 'Expected two recapture recommendations.');
    check(quality.quality?.evidenceViews?.[0]?.id === 'view_sign_west_oblique', 'The best available sign evidence view was not returned.');
    const recaptureMarkerCount = globalThis.window?.spatialDemo?.splatViewer?.qualityGroup?.children?.length ?? 0;
    check(recaptureMarkerCount >= 6, 'The 3D quality overlay did not render both recapture markers and sightlines.');
    check(document.querySelector('#details')?.textContent?.includes('view_sign_west_oblique'), 'The evidence view was not visible in the details panel.');

    const undo = await execute('undo_scene_change', {});
    check(undo.undone === true, 'The Lift 1 closure was not undone.');
    check(undo.change?.entityId === 'lift_1', 'Undo did not target Lift 1.');
    check(undo.change?.before?.operational === 'open', 'Undo did not restore Lift 1 to open.');
    check(undo.stagedChangeCount === 0, 'Undo did not restore a zero-change baseline.');
    const restoredContext = await execute('get_scene_context', {});
    check(restoredContext.stagedChangeCount === 0, 'Restored context does not have zero staged changes.');
    const restoredLift = await execute('get_entity', { entityId: 'lift_1' });
    check(restoredLift.entity?.state?.operational === 'open', 'Lift 1 is not open after undo.');

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
    const timeline = [...document.querySelectorAll('#tool-log li')].map((item) => ({
      sourceLabel: item.querySelector('strong')?.textContent?.split(' · ')[0] ?? '',
      tool: item.querySelector('strong')?.textContent?.split(' · ')[1] ?? '',
      status: item.dataset.status ?? '',
      visible: item.getClientRects().length > 0
    }));
    check(timeline.length === 10, 'Expected 10 visible timeline entries; found ' + timeline.length + '.');
    check(timeline.every((entry) => entry.sourceLabel === 'agent'), 'At least one timeline entry is not source-labelled agent.');
    check(timeline.every((entry) => entry.status === 'success'), 'At least one timeline entry did not finish successfully.');
    check(timeline.every((entry) => entry.visible), 'At least one timeline entry is not rendered visibly.');

    document.querySelector('.log-card')?.scrollIntoView({ block: 'start' });

    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        annotations: Object.fromEntries(Object.entries(tool.annotations ?? {}).sort(([left], [right]) => left.localeCompare(right)))
      })).sort((left, right) => left.name.localeCompare(right.name)),
      flow: {
        baseline: { stagedChangeCount: baseline.stagedChangeCount },
        navigation: {
          entityId: navigation.entity.id,
          selectedViewId: navigation.selectedViewId,
          cameraPose: navigatedContext.cameraPose,
          currentRegion: navigatedContext.currentRegion,
          nearbyHiddenEntityIds: navigatedContext.nearbyHiddenEntities.map((entity) => entity.id),
          connectedSpaceIds: navigatedContext.connectedSpaces.map((region) => region.id)
        },
        initialRoute: {
          from: initialRoute.from.label,
          to: initialRoute.to.label,
          lift: 'lift_1',
          entityIds: initialRoute.entityIds,
          warningRegions: initialRoute.warnings.map((warning) => warning.regionId)
        },
        closure: {
          entityId: closure.change.entityId,
          operational: closure.change.after.operational,
          stagedChangeCount: closure.stagedChangeCount
        },
        alternateRoute: {
          lift: 'lift_2',
          entityIds: alternateRoute.entityIds,
          warning: { regionId: westWarning.regionId, readiness: westWarning.readiness }
        },
        regionQuality: {
          regionId: quality.region.id,
          accessibleWayfindingReadiness: quality.quality.readiness.accessibleWayfinding,
          bestEvidenceViewIds: quality.quality.evidenceViews.map((view) => view.id),
          recommendationCount: quality.quality.recommendations.length,
          recaptureMarkerCount
        },
        undo: {
          entityId: undo.change.entityId,
          restoredOperational: restoredLift.entity.state.operational,
          stagedChangeCount: restoredContext.stagedChangeCount
        },
        timeline: {
          entryCount: timeline.length,
          allSourceLabelledAgent: timeline.every((entry) => entry.sourceLabel === 'agent'),
          allSuccessful: timeline.every((entry) => entry.status === 'success'),
          allVisible: timeline.every((entry) => entry.visible),
          tools: timeline.map((entry) => entry.tool).reverse()
        }
      }
    };
  })()`;

  const result = await connection.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

async function prepareEvidenceScreenshot(connection) {
  const expression = `(async () => {
    const tools = await Promise.resolve(document.modelContext.getTools());
    const tool = tools.find((candidate) => candidate.name === 'get_region_quality');
    if (!tool) throw new Error('Missing get_region_quality for screenshot preparation.');
    await document.modelContext.executeTool(tool, JSON.stringify({ regionId: 'west_corridor' }));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
    return globalThis.window?.spatialDemo?.splatViewer?.qualityGroup?.children?.length ?? 0;
  })()`;
  const result = await connection.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

async function captureScreenshot(connection, path) {
  const metrics = await connection.send("Page.getLayoutMetrics");
  const content = metrics.cssContentSize ?? metrics.contentSize;
  const width = Math.min(Math.ceil(content.width), 16_384);
  const height = Math.min(Math.ceil(content.height), 16_384);
  const result = await connection.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
    clip: { x: 0, y: 0, width, height, scale: 1 }
  });
  writeFileSync(resolve(path), Buffer.from(result.data, "base64"));
}

function describeConsoleCall(params) {
  return params.args.map((argument) => argument.value ?? argument.description ?? argument.type).join(" ");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const chromePath = resolve(options.chrome ?? MACOS_CHROME);
  try {
    accessSync(chromePath, constants.R_OK | constants.X_OK);
  } catch {
    throw new Error(`Chrome executable not found or unreadable: ${chromePath}`);
  }

  let targetUrl;
  try {
    targetUrl = new URL(options.url).href;
  } catch {
    throw new Error(`Invalid --url value: ${options.url}`);
  }

  const port = await freeLocalPort();
  assert(Number.isInteger(port) && port > 0, "Could not allocate a free localhost port.");
  const profileDirectory = mkdtempSync(resolve(tmpdir(), "webmcp-chrome-profile-"));
  let chrome;
  let connection;
  let cleanupPromise;
  let chromeStderr = "";

  const cleanup = () => {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      connection?.close();
      if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
        chrome.kill("SIGTERM");
        await Promise.race([
          new Promise((resolveExit) => chrome.once("exit", resolveExit)),
          delay(2_000)
        ]);
        if (chrome.exitCode === null && chrome.signalCode === null) {
          chrome.kill("SIGKILL");
          await Promise.race([
            new Promise((resolveExit) => chrome.once("exit", resolveExit)),
            delay(2_000)
          ]);
        }
      }
      assert(profileDirectory.startsWith(resolve(tmpdir(), "webmcp-chrome-profile-")), "Refusing to remove an unexpected profile directory.");
      rmSync(profileDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    })();
    return cleanupPromise;
  };
  const stopForSignal = (signal) => {
    void cleanup().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
  };
  process.once("SIGINT", stopForSignal);
  process.once("SIGTERM", stopForSignal);

  let receipt;
  try {
    chrome = spawn(chromePath, [
      "--headless=new",
      "--enable-features=WebMCPTesting",
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profileDirectory}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--window-size=1440,1000",
      "about:blank"
    ], { stdio: ["ignore", "ignore", "pipe"] });
    chrome.stderr.setEncoding("utf8");
    chrome.stderr.on("data", (chunk) => { chromeStderr += chunk; });
    chrome.once("error", (error) => { chromeStderr += `\n${error.message}`; });

    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, "Chrome DevTools");
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`, "a Chrome page target");
    const target = targets.find((candidate) => candidate.type === "page");
    assert(target?.webSocketDebuggerUrl, "Chrome did not expose a page DevTools target.");

    connection = new DevToolsConnection(target.webSocketDebuggerUrl);
    const consoleErrors = [];
    connection.on("Runtime.consoleAPICalled", (params) => {
      if (params.type === "error" || params.type === "assert") consoleErrors.push(describeConsoleCall(params));
    });
    connection.on("Runtime.exceptionThrown", (params) => {
      consoleErrors.push(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? "Uncaught page exception");
    });
    connection.on("Log.entryAdded", ({ entry }) => {
      if (entry?.level === "error") consoleErrors.push(entry.text);
    });

    await Promise.all([
      connection.send("Runtime.enable"),
      connection.send("Page.enable"),
      connection.send("Log.enable")
    ]);
    const pageNavigationStartedAt = Date.now();
    await connection.send("Page.navigate", { url: targetUrl });
    const registration = await waitForPage(connection);
    const navigationToWebMcpReadyMs = Date.now() - pageNavigationStartedAt;
    assert(registration.registered === true, `WebMCP registration did not activate: ${registration.statusText}`);
    assert(registration.count === 10, `The page reported ${registration.count} registered tools instead of 10.`);
    assert(navigationToWebMcpReadyMs < 5_000, `WebMCP readiness took ${navigationToWebMcpReadyMs} ms, exceeding five seconds.`);

    const evidence = await evaluateFlow(connection);
    const artifact = await readBuildArtifact(targetUrl);
    let screenshotEvidenceMarkerCount = null;
    if (options.screenshot) {
      screenshotEvidenceMarkerCount = await prepareEvidenceScreenshot(connection);
      assert(screenshotEvidenceMarkerCount >= 6, "Evidence screenshot preparation did not render recapture markers.");
    }
    await delay(100);
    const uniqueConsoleErrors = [...new Set(consoleErrors.filter(Boolean))];
    assert(uniqueConsoleErrors.length === 0, `Chrome recorded console errors: ${uniqueConsoleErrors.join(" | ")}`);

    if (options.screenshot) await captureScreenshot(connection, options.screenshot);
    receipt = {
      verifiedAt: new Date().toISOString(),
      chrome: {
        product: version.Browser,
        protocolVersion: version["Protocol-Version"],
        userAgent: version["User-Agent"]
      },
      url: targetUrl,
      artifact,
      timing: {
        navigationToWebMcpReadyMs,
        underFiveSeconds: true
      },
      webmcp: {
        status: "active",
        toolCount: evidence.tools.length,
        tools: evidence.tools
      },
      flow: evidence.flow,
      console: {
        capturedByCdp: true,
        errors: uniqueConsoleErrors
      },
      screenshot: options.screenshot ?? null,
      screenshotState: options.screenshot ? {
        description: "Verified flow after undo, followed by a fresh West corridor evidence overlay for the screenshot.",
        recaptureMarkerCount: screenshotEvidenceMarkerCount
      } : null,
      result: "passed"
    };
  } catch (error) {
    receipt = {
      verifiedAt: new Date().toISOString(),
      url: targetUrl,
      result: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
    if (chromeStderr.trim()) receipt.chromeStderr = chromeStderr.trim().split("\n").slice(-12);
  } finally {
    process.removeListener("SIGINT", stopForSignal);
    process.removeListener("SIGTERM", stopForSignal);
    await cleanup();
  }

  const encodedReceipt = `${JSON.stringify(receipt, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(options.output), encodedReceipt);
  process.stdout.write(encodedReceipt);
  if (receipt.result !== "passed") process.exitCode = 1;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`WebMCP Chrome verification failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { DevToolsConnection, parseArgs };
