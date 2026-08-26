import test from "node:test";
import assert from "node:assert/strict";
import { demoScene } from "../src/demo-scene.js";
import {
  STATION_SPACE,
  fallbackEntityViewPose,
  navigationPointToWorld,
  regionAtSemanticPosition,
  regionToWorldFootprint,
  resolveEntityView,
  semanticCapturePointToWorld,
  semanticPositionToWorld,
  worldPositionToSemantic
} from "../src/spatial-coordinates.js";

test("semantic positions round-trip between the sidecar and viewer space", () => {
  const semantic = [72, 47, 1];
  const world = semanticPositionToWorld(semantic);
  const restored = worldPositionToSemantic(world);
  assert.deepEqual(restored.map((value) => Number(value.toFixed(6))), semantic);
});

test("lift nodes on separate floors stay vertically aligned", () => {
  const lower = demoScene.navigation.nodes.find((node) => node.id === "n_lift1_lower");
  const upper = demoScene.navigation.nodes.find((node) => node.id === "n_lift1_upper");
  const lowerWorld = navigationPointToWorld(lower.point);
  const upperWorld = navigationPointToWorld(upper.point);
  assert.equal(lowerWorld[0], upperWorld[0]);
  assert.equal(lowerWorld[2], upperWorld[2]);
  assert.equal(Number((upperWorld[1] - lowerWorld[1]).toFixed(3)), STATION_SPACE.floorHeight);
});

test("region footprints preserve map dimensions at viewer scale", () => {
  const region = demoScene.regions.find((item) => item.id === "west_corridor");
  const footprint = regionToWorldFootprint(region);
  assert.equal(footprint.width, region.mapBounds.width * STATION_SPACE.scale);
  assert.equal(footprint.depth, region.mapBounds.height * STATION_SPACE.scale);
  assert.equal(footprint.floor, 0);
});

test("fallback entity views face the selected entity from a useful distance", () => {
  const entity = demoScene.entities.find((item) => item.id === "lift_1");
  const pose = fallbackEntityViewPose(entity);
  const distance = Math.hypot(
    pose.position[0] - pose.target[0],
    pose.position[1] - pose.target[1],
    pose.position[2] - pose.target[2]
  );
  assert.ok(distance > 2.5 && distance < 4);
});

test("named evidence poses drive entity navigation before the fallback", () => {
  const entity = demoScene.entities.find((item) => item.id === "lift_1");
  const expected = demoScene.evidenceViews.find((item) => item.id === entity.bestViewIds[0]).pose;
  assert.deepEqual(resolveEntityView(entity, demoScene.evidenceViews), {
    selectedViewId: "view_lift_1",
    pose: expected
  });

  const withoutEvidence = { ...entity, bestViewIds: ["missing_view"] };
  assert.deepEqual(resolveEntityView(withoutEvidence, demoScene.evidenceViews), {
    selectedViewId: null,
    pose: fallbackEntityViewPose(withoutEvidence)
  });
});

test("current region lookup follows a semantic camera position", () => {
  assert.equal(regionAtSemanticPosition(demoScene.regions, [8, 16, 0]).id, "entrance_a_zone");
  assert.equal(regionAtSemanticPosition(demoScene.regions, [30, 15, 0]).id, "ticketing_zone");
  assert.equal(regionAtSemanticPosition(demoScene.regions, [50, 40, 1]), null);
});

test("recapture poses map semantic height into viewer space", () => {
  const world = semanticCapturePointToWorld([65.5, 22, 1.6], 0);
  assert.deepEqual(world.map((value) => Number(value.toFixed(3))), [2.79, 1.72, -0.9]);
});
