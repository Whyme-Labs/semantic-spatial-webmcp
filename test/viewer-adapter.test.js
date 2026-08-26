import test from "node:test";
import assert from "node:assert/strict";
import { demoScene } from "../src/demo-scene.js";
import { SpatialSceneStore } from "../src/scene-store.js";
import { BrowserSpatialViewerAdapter } from "../src/viewer-adapter.js";

class RecordingBridge {
  constructor() {
    this.calls = [];
  }

  async getContext() {
    return {
      cameraPose: { position: [1, 2, 3], target: [4, 5, 6] },
      currentRegionId: "ticketing_zone",
      visibleEntityIds: ["accessible_gate_1"]
    };
  }

  async navigateToEntity(entity, options) { this.calls.push(["navigate", entity.id, options]); }
  async highlightEntities(ids) { this.calls.push(["highlight", ids]); }
  async setRoute(route) { this.calls.push(["route", route]); }
  async showQualityOverlay(quality) { this.calls.push(["quality", quality]); }
  async syncEntityState(entity) { this.calls.push(["state", entity.id, entity.state]); }
}

test("browser adapter reads live renderer context without losing semantic selection", async () => {
  const bridge = new RecordingBridge();
  const adapter = new BrowserSpatialViewerAdapter({ bridge, eventTarget: null });
  const entity = demoScene.entities.find((item) => item.id === "lift_1");
  await adapter.navigateToEntity(entity, { animate: false });
  const context = await adapter.getContext();
  assert.deepEqual(context.cameraPose.position, [1, 2, 3]);
  assert.equal(context.currentRegionId, "ticketing_zone");
  assert.equal(context.selectedEntityId, "lift_1");
  assert.deepEqual(context.visibleEntityIds, ["accessible_gate_1"]);
});

test("browser adapter preserves an explicit null camera region", async () => {
  const bridge = new RecordingBridge();
  bridge.getContext = async () => ({
    cameraPose: { position: [10, 2, 10], target: [0, 1, 0] },
    currentRegionId: null,
    selectedEntityId: null,
    visibleEntityIds: []
  });
  const adapter = new BrowserSpatialViewerAdapter({ bridge, eventTarget: null });
  const context = await adapter.getContext();
  assert.equal(context.currentRegionId, null);
  assert.equal(context.selectedEntityId, null);
});

test("browser adapter forwards route, quality, highlight, and navigation calls", async () => {
  const bridge = new RecordingBridge();
  const adapter = new BrowserSpatialViewerAdapter({ bridge, eventTarget: null });
  const entity = demoScene.entities.find((item) => item.id === "accessible_gate_1");
  await adapter.navigateToEntity(entity, { animate: true });
  await adapter.highlightEntities([entity.id]);
  await adapter.setRoute({ found: true });
  await adapter.showQualityOverlay({ regionId: "west_corridor" });
  assert.deepEqual(bridge.calls.map((call) => call[0]), ["navigate", "highlight", "route", "quality"]);
});

test("scenario changes synchronize effective store state with the renderer", async () => {
  const store = new SpatialSceneStore(demoScene);
  const bridge = new RecordingBridge();
  const adapter = new BrowserSpatialViewerAdapter({ bridge, store, eventTarget: null });
  const change = store.setEntityState("lift_1", { operational: "closed" });
  await adapter.onScenarioChanged([change]);
  assert.deepEqual(bridge.calls.at(-1), ["state", "lift_1", { operational: "closed" }]);

  store.resetScenario();
  await adapter.onScenarioChanged([]);
  const reset = bridge.calls.findLast((call) => call[0] === "state" && call[1] === "lift_1");
  assert.deepEqual(reset, ["state", "lift_1", { operational: "open" }]);
});
