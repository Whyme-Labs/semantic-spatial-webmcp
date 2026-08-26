// @ts-check

/**
 * Semantic scene store with reversible scenario patches.
 */
export class SpatialSceneStore {
  /** @param {any} scene */
  constructor(scene) {
    this.scene = structuredClone(scene);
    this.entities = new Map(scene.entities.map((entity) => [entity.id, structuredClone(entity)]));
    this.regions = new Map(scene.regions.map((region) => [region.id, structuredClone(region)]));
    this.quality = new Map(scene.quality.map((record) => [record.regionId, structuredClone(record)]));
    this.scenarioHistory = [];
  }

  /** @param {string} id */
  getEntity(id) {
    const entity = this.entities.get(id);
    return entity ? structuredClone(entity) : null;
  }

  /** @param {string} id */
  getRegion(id) {
    const region = this.regions.get(id);
    return region ? structuredClone(region) : null;
  }

  /** @param {string} regionId */
  getRegionQuality(regionId) {
    const record = this.quality.get(regionId);
    return record ? structuredClone(record) : null;
  }

  /**
   * @param {{query?:string,type?:string,regionId?:string,tags?:string[],limit?:number}} filters
   */
  searchEntities(filters = {}) {
    const query = String(filters.query ?? "").trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);
    const requiredTags = filters.tags ?? [];
    const results = [];

    for (const entity of this.entities.values()) {
      if (filters.type && entity.type !== filters.type) continue;
      if (filters.regionId && entity.regionId !== filters.regionId) continue;
      if (requiredTags.length && !requiredTags.every((tag) => entity.tags.includes(tag))) continue;

      const haystack = [entity.id, entity.type, entity.label, entity.description, ...entity.aliases, ...entity.tags]
        .join(" ")
        .toLowerCase();

      if (tokens.some((token) => !haystack.includes(token))) continue;

      let score = 0;
      if (!query) score = 0.5;
      if (entity.label.toLowerCase() === query) score += 10;
      if (entity.label.toLowerCase().includes(query)) score += 5;
      if (entity.aliases.some((alias) => alias.toLowerCase() === query)) score += 4;
      for (const token of tokens) {
        if (entity.type.includes(token)) score += 2;
        if (entity.tags.some((tag) => tag.includes(token))) score += 1.5;
        if (haystack.includes(token)) score += 1;
      }
      score += entity.confidence.category;

      results.push({
        id: entity.id,
        label: entity.label,
        type: entity.type,
        regionId: entity.regionId,
        score: Number(score.toFixed(3)),
        state: structuredClone(entity.state),
        confidence: structuredClone(entity.confidence)
      });
    }

    return results
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, Math.max(1, Math.min(filters.limit ?? 10, 50)));
  }

  /** @param {string} entityId */
  getRelations(entityId) {
    return this.scene.relations
      .filter((relation) => relation.subjectId === entityId || relation.objectId === entityId)
      .map((relation) => structuredClone(relation));
  }

  /**
   * Stage a reversible entity-state patch.
   * @param {string} entityId
   * @param {Record<string,string|number|boolean>} patch
   */
  setEntityState(entityId, patch) {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`Unknown entity: ${entityId}`);
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new TypeError("State patch must be an object.");
    }

    const before = structuredClone(entity.state);
    entity.state = { ...entity.state, ...patch };
    const change = {
      id: `change_${this.scenarioHistory.length + 1}`,
      entityId,
      before,
      after: structuredClone(entity.state),
      timestamp: new Date().toISOString()
    };
    this.scenarioHistory.push(change);
    return structuredClone(change);
  }

  undoLastChange() {
    const change = this.scenarioHistory.pop();
    if (!change) return null;
    const entity = this.entities.get(change.entityId);
    if (!entity) throw new Error(`Entity disappeared during undo: ${change.entityId}`);
    entity.state = structuredClone(change.before);
    return structuredClone(change);
  }

  resetScenario() {
    const undone = [];
    while (this.scenarioHistory.length) {
      const change = this.undoLastChange();
      if (change) undone.push(change);
    }
    return undone;
  }

  getScenarioHistory() {
    return structuredClone(this.scenarioHistory);
  }

  listUncertainEntities(threshold = 0.75) {
    return [...this.entities.values()]
      .filter((entity) => Math.min(
        entity.confidence.category,
        entity.confidence.boundary,
        entity.confidence.geometry,
        entity.confidence.coverage
      ) < threshold)
      .map((entity) => ({
        id: entity.id,
        label: entity.label,
        regionId: entity.regionId,
        confidence: structuredClone(entity.confidence),
        weakestDimension: Object.entries(entity.confidence)
          .sort((a, b) => Number(a[1]) - Number(b[1]))[0][0]
      }))
      .sort((a, b) => Math.min(...Object.values(a.confidence)) - Math.min(...Object.values(b.confidence)));
  }

  isEntityOperational(entityId) {
    const entity = this.entities.get(entityId);
    return Boolean(entity && entity.state.operational !== "closed" && entity.state.operational !== "unavailable");
  }

  isEntityBlocking(entityId) {
    const entity = this.entities.get(entityId);
    return Boolean(entity && (entity.state.active === true || entity.state.blocking === true));
  }
}
