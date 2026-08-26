import test from "node:test";
import assert from "node:assert/strict";
import { demoScene } from "../src/demo-scene.js";
import { SpatialSceneStore } from "../src/scene-store.js";
import { SpatialToolRuntime } from "../src/tool-runtime.js";
import { MemoryViewerAdapter } from "../src/viewer-adapter.js";

function setup() {
  const store = new SpatialSceneStore(demoScene);
  const viewer = new MemoryViewerAdapter();
  return { store, viewer, runtime: new SpatialToolRuntime(store, viewer) };
}

test("tool runtime exposes ten narrow tools", () => {
  const { runtime } = setup();
  assert.equal(runtime.listTools().length, 10);
  assert.ok(runtime.listTools().every((tool) => tool.name.length < 30));
});

test("route tool updates the shared viewer adapter", async () => {
  const { runtime, viewer } = setup();
  const route = await runtime.invoke("find_semantic_route", {
    from: "n_entrance", to: "n_platform", accessibleOnly: true
  });
  assert.equal(route.found, true);
  assert.equal(viewer.route.found, true);
  assert.ok(viewer.highlighted.includes("lift_1"));
});

test("quality tool returns evidence gaps and updates the overlay", async () => {
  const { runtime, viewer } = setup();
  const result = await runtime.invoke("get_region_quality", { regionId: "west_corridor" });
  assert.equal(result.found, true);
  assert.equal(result.quality.gaps.length, 2);
  assert.equal(viewer.quality.regionId, "west_corridor");
});

test("state tool changes route outcome", async () => {
  const { runtime } = setup();
  await runtime.invoke("set_entity_state", { entityId: "lift_1", patch: { operational: "closed" } });
  const route = await runtime.invoke("find_semantic_route", {
    from: "n_entrance", to: "n_platform", accessibleOnly: true
  });
  assert.ok(route.nodeIds.includes("n_lift2_lower"));
});

test("unknown entity returns not found instead of inventing one", async () => {
  const { runtime } = setup();
  const result = await runtime.invoke("get_entity", { entityId: "dragon_99" });
  assert.deepEqual(result, { found: false, entityId: "dragon_99" });
});
