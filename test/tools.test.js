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
  const tools = runtime.listTools();
  assert.equal(tools.length, 10);
  assert.ok(tools.every((tool) => tool.name.length < 30));
  assert.ok(tools.some((tool) => tool.name === "reset_scene"));
  assert.ok(tools.every((tool) => tool.name !== "recommend_recapture"));
  assert.ok(tools.every((tool) => Object.keys(tool.annotations).every(
    (key) => ["readOnlyHint", "untrustedContentHint"].includes(key)
  )));
});

test("route tool accepts public labels and hides navigation-node IDs", async () => {
  const { runtime, viewer } = setup();
  const route = await runtime.invoke("find_semantic_route", {
    from: "Entrance A", to: "Platform 2", accessibleOnly: true
  });
  assert.equal(route.found, true);
  assert.equal(viewer.route.found, true);
  assert.ok(viewer.highlighted.includes("lift_1"));
  assert.doesNotMatch(JSON.stringify(route), /"n_[^"]+"/);
  assert.equal(route.from.label, "Entrance A");
  assert.equal(route.to.label, "Platform 2");
});

test("route endpoints accept aliases, entity IDs, and region IDs", async () => {
  for (const [from, to] of [
    ["main entrance", "platform_2_zone"],
    ["entrance_a", "platform_2_zone"],
    ["entrance_a_zone", "Platform 2"]
  ]) {
    const { runtime } = setup();
    const route = await runtime.invoke("find_semantic_route", { from, to });
    assert.equal(route.found, true, `${from} -> ${to}`);
    assert.doesNotMatch(JSON.stringify(route), /"n_[^"]+"/);
  }
});

test("scene context includes nearby hidden entities and connected spaces", async () => {
  const { runtime, viewer } = setup();
  viewer.context.currentRegionId = "ticketing_zone";
  viewer.context.visibleEntityIds = ["accessible_gate_1"];
  const result = await runtime.invoke("get_scene_context", {});
  assert.ok(result.nearbyHiddenEntities.some((entity) => entity.id === "ticket_machine_1"));
  assert.ok(result.nearbyHiddenEntities.some((entity) => entity.id === "help_point_1"));
  assert.ok(result.connectedSpaces.some((region) => region.id === "entrance_a_zone"));
  assert.ok(result.connectedSpaces.some((region) => region.id === "east_corridor"));
  assert.ok(result.connectedSpaces.some((region) => region.id === "west_corridor"));
});

test("quality tool returns evidence gaps and updates the overlay", async () => {
  const { runtime, viewer } = setup();
  const result = await runtime.invoke("get_region_quality", { regionId: "west_corridor" });
  assert.equal(result.found, true);
  assert.equal(result.quality.gaps.length, 2);
  assert.deepEqual(result.quality.evidenceViews.map((view) => view.id), ["view_sign_west_oblique"]);
  assert.ok(viewer.highlighted.includes("sign_west_platform"));
  assert.equal(viewer.quality.regionId, "west_corridor");
  assert.deepEqual(viewer.quality.evidenceViews.map((view) => view.id), ["view_sign_west_oblique"]);
});

test("state tool changes route outcome", async () => {
  const { runtime } = setup();
  await runtime.invoke("set_entity_state", { entityId: "lift_1", patch: { operational: "closed" } });
  const route = await runtime.invoke("find_semantic_route", {
    from: "Entrance A", to: "Platform 2", accessibleOnly: true
  });
  assert.ok(route.steps.some((step) => step.label === "Lift 2 concourse"));
});

test("state changes invalidate derived overlays and undo leaves a clean baseline", async () => {
  const { runtime, store, viewer } = setup();
  await runtime.invoke("find_semantic_route", { from: "Entrance A", to: "Platform 2" });
  await runtime.invoke("get_region_quality", { regionId: "west_corridor" });

  await runtime.invoke("set_entity_state", { entityId: "lift_1", patch: { operational: "closed" } });
  assert.equal(viewer.route, null);
  assert.equal(viewer.quality, null);

  await runtime.invoke("find_semantic_route", { from: "Entrance A", to: "Platform 2" });
  await runtime.invoke("get_region_quality", { regionId: "west_corridor" });
  await runtime.invoke("undo_scene_change", {});

  assert.deepEqual(store.getEntity("lift_1").state, { operational: "open" });
  assert.equal(viewer.route, null);
  assert.equal(viewer.quality, null);
});

test("unknown entity returns not found instead of inventing one", async () => {
  const { runtime } = setup();
  const result = await runtime.invoke("get_entity", { entityId: "dragon_99" });
  assert.deepEqual(result, { found: false, entityId: "dragon_99" });
});

test("reset tool restores state and clears shared overlays", async () => {
  const { runtime, store, viewer } = setup();
  await runtime.invoke("set_entity_state", { entityId: "lift_1", patch: { operational: "closed" } });
  await runtime.invoke("find_semantic_route", { from: "Entrance A", to: "Platform 2" });
  await runtime.invoke("get_region_quality", { regionId: "west_corridor" });

  const result = await runtime.invoke("reset_scene", {});

  assert.equal(result.reset, true);
  assert.equal(result.undoneChangeCount, 1);
  assert.deepEqual(store.getEntity("lift_1").state, { operational: "open" });
  assert.equal(viewer.route, null);
  assert.equal(viewer.quality, null);
});

test("observer receives source-labelled start and terminal events", async () => {
  const { runtime } = setup();
  const events = [];
  const unsubscribe = runtime.observe((event) => events.push(event));

  await runtime.invoke("get_entity", { entityId: "lift_1" }, { source: "agent" });
  unsubscribe();

  assert.deepEqual(events.map((event) => [event.phase, event.source]), [
    ["start", "agent"],
    ["terminal", "agent"]
  ]);
  assert.equal(events[1].status, "success");
});

test("human and agent navigation share results and viewer effects", async () => {
  const { runtime, viewer } = setup();
  const events = [];
  runtime.observe((event) => events.push(event));

  const human = await runtime.invoke(
    "navigate_to_entity",
    { entityId: "help_point_1", animate: false },
    { source: "human" }
  );
  const humanNavigation = structuredClone(viewer.lastNavigation);
  const agent = await runtime.invoke(
    "navigate_to_entity",
    { entityId: "help_point_1", animate: false },
    { source: "agent" }
  );

  assert.deepEqual(agent, human);
  assert.deepEqual(viewer.lastNavigation, humanNavigation);
  assert.deepEqual(events.filter((event) => event.phase === "start").map((event) => event.source), ["human", "agent"]);
});

test("failed invocations reject and produce one terminal error event", async () => {
  const { runtime } = setup();
  const events = [];
  runtime.observe((event) => events.push(event));

  await assert.rejects(
    runtime.invoke("get_entity", { entityId: "lift_1", extra: true }, { source: "human" }),
    /additional property/
  );

  assert.equal(events.filter((event) => event.phase === "terminal").length, 1);
  assert.equal(events.at(-1).status, "error");
});
