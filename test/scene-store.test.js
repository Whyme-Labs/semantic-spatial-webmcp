import test from "node:test";
import assert from "node:assert/strict";
import { demoScene } from "../src/demo-scene.js";
import { SpatialSceneStore } from "../src/scene-store.js";

test("semantic search finds the accessible fare gate", () => {
  const store = new SpatialSceneStore(demoScene);
  const results = store.searchEntities({ query: "accessible gate" });
  assert.equal(results[0].id, "accessible_gate_1");
});

test("state changes are reversible", () => {
  const store = new SpatialSceneStore(demoScene);
  const change = store.setEntityState("lift_1", { operational: "closed" });
  assert.equal(change.before.operational, "open");
  assert.equal(store.getEntity("lift_1").state.operational, "closed");
  store.undoLastChange();
  assert.equal(store.getEntity("lift_1").state.operational, "open");
});

test("uncertain entities expose the weak dimension", () => {
  const store = new SpatialSceneStore(demoScene);
  const uncertain = store.listUncertainEntities(0.8);
  assert.equal(uncertain[0].id, "sign_west_platform");
  assert.equal(uncertain[0].weakestDimension, "coverage");
});
