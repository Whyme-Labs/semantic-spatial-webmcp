import test from "node:test";
import assert from "node:assert/strict";
import { demoScene } from "../src/demo-scene.js";
import { SpatialSceneStore } from "../src/scene-store.js";
import { RoutePlanner } from "../src/route-planner.js";

function setup() {
  const store = new SpatialSceneStore(demoScene);
  return { store, planner: new RoutePlanner(demoScene.navigation, store) };
}

test("baseline accessible route uses Lift 1", () => {
  const { planner } = setup();
  const route = planner.findRoute({ from: "n_entrance", to: "n_platform", accessibleOnly: true });
  assert.equal(route.found, true);
  assert.ok(route.nodeIds.includes("n_lift1_lower"));
  assert.ok(!route.nodeIds.includes("n_lift2_lower"));
  assert.equal(route.warnings.length, 0);
});

test("closing Lift 1 selects Lift 2 and exposes capture warning", () => {
  const { store, planner } = setup();
  store.setEntityState("lift_1", { operational: "closed" });
  const route = planner.findRoute({ from: "n_entrance", to: "n_platform", accessibleOnly: true });
  assert.equal(route.found, true);
  assert.ok(route.nodeIds.includes("n_lift2_lower"));
  assert.ok(route.warnings.some((warning) => warning.regionId === "west_corridor"));
});

test("blocking east corridor selects the alternate route", () => {
  const { store, planner } = setup();
  store.setEntityState("barrier_east", { active: true });
  const route = planner.findRoute({ from: "n_entrance", to: "n_platform", accessibleOnly: true });
  assert.equal(route.found, true);
  assert.ok(route.nodeIds.includes("n_lift2_lower"));
});

test("both lifts closed produces an explicit no-route result", () => {
  const { store, planner } = setup();
  store.setEntityState("lift_1", { operational: "closed" });
  store.setEntityState("lift_2", { operational: "closed" });
  const route = planner.findRoute({ from: "n_entrance", to: "n_platform", accessibleOnly: true });
  assert.equal(route.found, false);
  assert.deepEqual(new Set(route.unavailableEntities), new Set(["lift_1", "lift_2"]));
});
