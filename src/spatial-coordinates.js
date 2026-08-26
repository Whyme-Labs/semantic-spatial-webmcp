// @ts-check

export const STATION_SPACE = Object.freeze({
  scale: 0.18,
  floorHeight: 3.4,
  floorMapOffset: 35,
  originX: 50,
  originY: 17
});

/** @param {number} mapY @param {number} floor */
function localMapY(mapY, floor) {
  return mapY - floor * STATION_SPACE.floorMapOffset;
}

/**
 * Convert a semantic entity position [map x, map y, floor] to viewer space.
 * @param {[number, number, number]} position
 * @returns {[number, number, number]}
 */
export function semanticPositionToWorld(position) {
  const [mapX, mapY, floor = 0] = position;
  return [
    (mapX - STATION_SPACE.originX) * STATION_SPACE.scale,
    floor * STATION_SPACE.floorHeight + 0.12,
    -(localMapY(mapY, floor) - STATION_SPACE.originY) * STATION_SPACE.scale
  ];
}

/**
 * Convert a navigation graph point to viewer space.
 * @param {{x:number,y:number,floor:number}} point
 * @returns {[number, number, number]}
 */
export function navigationPointToWorld(point) {
  return semanticPositionToWorld([point.x, point.y, point.floor]);
}

/**
 * Convert a semantic capture-pose point [map x, map y, height] to viewer space.
 * @param {[number,number,number]} point
 * @param {number} floor
 */
export function semanticCapturePointToWorld(point, floor) {
  const base = semanticPositionToWorld([point[0], point[1], floor]);
  return [base[0], base[1] + point[2], base[2]];
}

/**
 * Convert viewer coordinates back to the semantic station map.
 * @param {[number, number, number]} position
 * @returns {[number, number, number]}
 */
export function worldPositionToSemantic(position) {
  const [worldX, worldY, worldZ] = position;
  const floor = Math.max(0, Math.round((worldY - 0.12) / STATION_SPACE.floorHeight));
  return [
    worldX / STATION_SPACE.scale + STATION_SPACE.originX,
    -worldZ / STATION_SPACE.scale + STATION_SPACE.originY + floor * STATION_SPACE.floorMapOffset,
    floor
  ];
}

/**
 * Return an axis-aligned viewer-space footprint for a semantic region.
 * @param {{floor:number,mapBounds:{x:number,y:number,width:number,height:number}}} region
 */
export function regionToWorldFootprint(region) {
  const { x, y, width, height } = region.mapBounds;
  const center = semanticPositionToWorld([
    x + width / 2,
    y + height / 2,
    region.floor
  ]);
  return {
    center,
    width: width * STATION_SPACE.scale,
    depth: height * STATION_SPACE.scale,
    floor: region.floor
  };
}

/**
 * Return the smallest semantic zone containing a semantic-space position.
 * @param {any[]} regions
 * @param {[number,number,number]} position
 */
export function regionAtSemanticPosition(regions, position) {
  const [x, y, floor] = position;
  return regions
    .filter((region) => region.type === "zone" && region.floor === floor)
    .filter((region) => x >= region.mapBounds.x && x <= region.mapBounds.x + region.mapBounds.width)
    .filter((region) => y >= region.mapBounds.y && y <= region.mapBounds.y + region.mapBounds.height)
    .sort((left, right) => left.mapBounds.width * left.mapBounds.height - right.mapBounds.width * right.mapBounds.height)[0] ?? null;
}

/**
 * Derive a stable camera pose when the sidecar does not yet provide a captured
 * best-view pose for an entity.
 * @param {{type:string,position:[number,number,number]}} entity
 */
export function fallbackEntityViewPose(entity) {
  const target = semanticPositionToWorld(entity.position);
  const distance = entity.type === "lift" || entity.type === "escalator" ? 3.1 : 2.4;
  const cameraHeight = entity.type === "bench" ? 1.15 : 1.55;
  return {
    target: [target[0], target[1] + 0.7, target[2]],
    position: [target[0] - distance * 0.72, target[1] + cameraHeight, target[2] + distance]
  };
}

/**
 * Resolve the first named evidence view with a camera pose, or derive a stable fallback.
 * @param {{type:string,position:[number,number,number],bestViewIds?:string[]}} entity
 * @param {any[]} evidenceViews
 */
export function resolveEntityView(entity, evidenceViews) {
  const view = (entity.bestViewIds ?? [])
    .map((viewId) => evidenceViews.find((candidate) => candidate.id === viewId))
    .find((candidate) => candidate?.pose?.position && candidate?.pose?.target);
  return {
    selectedViewId: view?.id ?? null,
    pose: view ? structuredClone(view.pose) : fallbackEntityViewPose(entity)
  };
}
