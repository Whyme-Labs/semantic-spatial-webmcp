import test from "node:test";
import assert from "node:assert/strict";
import { registerWebMCPTools } from "../src/webmcp-adapter.js";

const definitions = ["one", "two"].map((name) => ({
  name,
  description: `Run ${name}.`,
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true }
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

test("registration waits for readiness and resolves only after every tool", async () => {
  const ready = deferred();
  const registration = [deferred(), deferred()];
  const calls = [];
  const statuses = [];
  const runtime = { listTools: () => definitions, invoke: async () => ({ ok: true }) };
  const modelContext = {
    registerTool(tool, options) {
      calls.push({ tool, options });
      return registration[calls.length - 1].promise;
    }
  };

  let settled = false;
  const resultPromise = registerWebMCPTools(runtime, {
    readiness: ready.promise,
    modelContext,
    onStatus: (status) => statuses.push(status)
  }).then((value) => {
    settled = true;
    return value;
  });
  await Promise.resolve();
  assert.equal(calls.length, 0);

  ready.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.signal, calls[1].options.signal);
  registration[0].resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  registration[1].resolve();

  const result = await resultPromise;
  assert.equal(result.registered, true);
  assert.equal(result.count, 2);
  assert.equal(statuses.at(-1).state, "active");
  result.dispose();
  assert.equal(calls[0].options.signal.aborted, true);
});

test("one registration rejection aborts and settles the whole catalog", async () => {
  const calls = [];
  const statuses = [];
  const runtime = { listTools: () => definitions, invoke: async () => ({ ok: true }) };
  const modelContext = {
    registerTool(tool, options) {
      calls.push({ tool, options });
      if (tool.name === "one") return Promise.reject(new Error("registration failed"));
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    }
  };

  await assert.rejects(
    registerWebMCPTools(runtime, { modelContext, onStatus: (status) => statuses.push(status) }),
    /registration failed/
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.signal.aborted, true);
  assert.ok(statuses.every((status) => status.state !== "active"));
  assert.equal(statuses.at(-1).state, "error");
});

test("registered execute returns raw JSON and passes exact source and signal", async () => {
  const calls = [];
  let registered;
  const expected = { found: true, id: "lift_1" };
  const runtime = {
    listTools: () => definitions.slice(0, 1),
    async invoke(...args) {
      calls.push(args);
      return expected;
    }
  };
  const modelContext = { async registerTool(tool) { registered = tool; } };
  await registerWebMCPTools(runtime, { modelContext });
  const controller = new AbortController();

  const result = await registered.execute({}, { signal: controller.signal });

  assert.deepEqual(result, expected);
  assert.deepEqual(calls[0].slice(0, 2), ["one", {}]);
  assert.equal(calls[0][2].source, "agent");
  assert.equal(calls[0][2].signal, controller.signal);
});

test("registered execute lets runtime errors reject", async () => {
  let registered;
  const runtime = {
    listTools: () => definitions.slice(0, 1),
    async invoke() { throw new Error("tool failed"); }
  };
  const modelContext = { async registerTool(tool) { registered = tool; } };
  await registerWebMCPTools(runtime, { modelContext });
  await assert.rejects(registered.execute({}, { signal: new AbortController().signal }), /tool failed/);
});

test("unsupported WebMCP reports local-only mode without registering", async () => {
  const statuses = [];
  let humanCalls = 0;
  const runtime = { listTools: () => definitions, invoke: async () => { humanCalls += 1; return { ok: true }; } };
  const result = await registerWebMCPTools(runtime, {
    modelContext: null,
    onStatus: (status) => statuses.push(status)
  });
  assert.equal(result.registered, false);
  assert.equal(result.count, 0);
  assert.equal(statuses.at(-1).state, "unsupported");
  assert.deepEqual(await runtime.invoke("one", {}, { source: "human" }), { ok: true });
  assert.equal(humanCalls, 1);
});

test("catalog preflight rejects unsupported metadata before registration", async () => {
  let registrationCalls = 0;
  const runtime = {
    listTools: () => [{ ...definitions[0], annotations: { destructiveHint: false } }]
  };
  const modelContext = { async registerTool() { registrationCalls += 1; } };

  await assert.rejects(registerWebMCPTools(runtime, { modelContext }), /unsupported annotation/);
  assert.equal(registrationCalls, 0);
});
