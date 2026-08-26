import test from "node:test";
import assert from "node:assert/strict";
import { demoScene } from "../src/demo-scene.js";
import { SpatialSceneStore } from "../src/scene-store.js";
import { SpatialToolRuntime } from "../src/tool-runtime.js";
import { MemoryViewerAdapter } from "../src/viewer-adapter.js";

function setup(viewer = new MemoryViewerAdapter()) {
  const store = new SpatialSceneStore(demoScene);
  return { store, viewer, runtime: new SpatialToolRuntime(store, viewer) };
}

test("runtime schemas reject extra fields, wrong types, and invalid ranges", async () => {
  const { runtime } = setup();
  await assert.rejects(runtime.invoke("get_scene_context", { extra: true }), /additional property/);
  await assert.rejects(runtime.invoke("search_entities", { tags: ["public", 4] }), /must be a string/);
  await assert.rejects(runtime.invoke("search_entities", { limit: 0 }), /at least 1/);
  await assert.rejects(runtime.invoke("list_uncertain_entities", { threshold: 1.1 }), /at most 1/);
});

test("state patches reject unsupported keys and values before commit", async () => {
  const { runtime, store } = setup();
  await assert.rejects(
    runtime.invoke("set_entity_state", { entityId: "lift_1", patch: { colour: "blue" } }),
    /additional property/
  );
  await assert.rejects(
    runtime.invoke("set_entity_state", { entityId: "lift_1", patch: { operational: "exploded" } }),
    /supported value/
  );
  await assert.rejects(
    runtime.invoke("set_entity_state", { entityId: "barrier_east", patch: { operational: "closed" } }),
    /does not support state field/
  );
  assert.equal(store.getScenarioHistory().length, 0);
});

test("every successful tool result is plain JSON within the output budget", async () => {
  const invocations = [
    ["get_scene_context", {}],
    ["search_entities", { query: "", limit: 10 }],
    ["get_entity", { entityId: "sign_west_platform" }],
    ["navigate_to_entity", { entityId: "help_point_1", animate: false }],
    ["find_semantic_route", { from: "Entrance A", to: "Platform 2" }],
    ["set_entity_state", { entityId: "lift_1", patch: { operational: "closed" } }],
    ["undo_scene_change", {}],
    ["get_region_quality", { regionId: "west_corridor" }],
    ["list_uncertain_entities", { threshold: 1, limit: 10 }],
    ["reset_scene", {}]
  ];

  for (const [name, args] of invocations) {
    const { runtime, viewer } = setup();
    if (name === "get_scene_context") {
      viewer.context.visibleEntityIds = demoScene.entities.map((entity) => entity.id);
    }
    const result = await runtime.invoke(name, args);
    const encoded = JSON.stringify(result);
    assert.ok(encoded.length <= 1450, `${name} emitted ${encoded.length} characters`);
    assert.deepEqual(JSON.parse(encoded), result, `${name} did not return plain JSON`);
  }
});

test("navigation cancellation reaches the viewer and rejects", async () => {
  let receivedSignal;
  const viewer = new MemoryViewerAdapter();
  viewer.navigateToEntity = async (_entity, options) => {
    receivedSignal = options.signal;
    await new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    });
  };
  const { runtime } = setup(viewer);
  const controller = new AbortController();
  const invocation = runtime.invoke(
    "navigate_to_entity",
    { entityId: "lift_1" },
    { source: "agent", signal: controller.signal }
  );
  controller.abort(new DOMException("Stopped", "AbortError"));

  await assert.rejects(invocation, { name: "AbortError" });
  assert.equal(receivedSignal, controller.signal);
});

test("state cancellation is checked before the store commit", async () => {
  const { runtime, store } = setup();
  const controller = new AbortController();
  controller.abort(new DOMException("Stopped", "AbortError"));
  await assert.rejects(
    runtime.invoke(
      "set_entity_state",
      { entityId: "lift_1", patch: { operational: "closed" } },
      { signal: controller.signal }
    ),
    { name: "AbortError" }
  );
  assert.equal(store.getScenarioHistory().length, 0);
  assert.deepEqual(store.getEntity("lift_1").state, { operational: "open" });
});

test("non-JSON tool output is rejected at the runtime boundary", async () => {
  const { runtime } = setup();
  runtime.toolMap.set("bad_output", {
    name: "bad_output",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => ({ value: undefined })
  });
  await assert.rejects(runtime.invoke("bad_output", {}), /plain JSON/);
});

test("oversized tool output is rejected rather than truncated", async () => {
  const { runtime } = setup();
  runtime.toolMap.set("large_output", {
    name: "large_output",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => ({ value: "x".repeat(1450) })
  });
  await assert.rejects(runtime.invoke("large_output", {}), /1450-character budget/);
});
