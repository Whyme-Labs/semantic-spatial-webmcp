// @ts-check

import { RoutePlanner } from "./route-planner.js";

const ensureString = (value, name) => {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} must be a non-empty string.`);
  return value.trim();
};

const compactEntity = (entity, relations = []) => ({
  id: entity.id,
  label: entity.label,
  type: entity.type,
  regionId: entity.regionId,
  position: entity.position,
  tags: entity.tags,
  description: entity.description,
  state: entity.state,
  confidence: entity.confidence,
  bestViewIds: entity.bestViewIds,
  relations
});

export class SpatialToolRuntime {
  /**
   * @param {import('./scene-store.js').SpatialSceneStore} store
   * @param {any} viewer
   */
  constructor(store, viewer) {
    this.store = store;
    this.viewer = viewer;
    this.routePlanner = new RoutePlanner(store.scene.navigation, store);
    this.tools = this.buildTools();
    this.toolMap = new Map(this.tools.map((tool) => [tool.name, tool]));
  }

  listTools() {
    return this.tools.map(({ execute, ...definition }) => structuredClone(definition));
  }

  async invoke(name, args = {}) {
    const tool = this.toolMap.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.execute(args);
  }

  buildTools() {
    return [
      {
        name: "get_scene_context",
        description: "Read the live camera, current region, selection, visible entities, and staged changes.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async () => {
          const context = await this.viewer.getContext();
          return {
            scene: { id: this.store.scene.id, label: this.store.scene.label },
            ...context,
            currentRegion: context.currentRegionId ? this.store.getRegion(context.currentRegionId) : null,
            selectedEntity: context.selectedEntityId ? this.store.getEntity(context.selectedEntityId) : null,
            visibleEntities: context.visibleEntityIds.map((id) => this.store.getEntity(id)).filter(Boolean),
            stagedChanges: this.store.getScenarioHistory()
          };
        }
      },
      {
        name: "search_entities",
        description: "Search named objects in the scene by text, type, region, or tags.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Words describing the object." },
            type: { type: "string", description: "Optional exact entity type." },
            regionId: { type: "string", description: "Optional region ID." },
            tags: { type: "array", items: { type: "string" }, description: "Required tags." },
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (args) => {
          const results = this.store.searchEntities(args);
          await this.viewer.highlightEntities(results.map((result) => result.id));
          return { count: results.length, results };
        }
      },
      {
        name: "get_entity",
        description: "Read one spatial entity, its state, confidence, room, and relationships.",
        inputSchema: {
          type: "object",
          properties: { entityId: { type: "string", description: "Stable entity ID." } },
          required: ["entityId"], additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async (args) => {
          const entityId = ensureString(args.entityId, "entityId");
          const entity = this.store.getEntity(entityId);
          if (!entity) return { found: false, entityId };
          const region = this.store.getRegion(entity.regionId);
          return { found: true, entity: compactEntity(entity, this.store.getRelations(entityId)), region };
        }
      },
      {
        name: "navigate_to_entity",
        description: "Move the shared viewer to the best known view of a named entity.",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", description: "Stable entity ID." },
            animate: { type: "boolean", default: true }
          },
          required: ["entityId"], additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async (args) => {
          const entityId = ensureString(args.entityId, "entityId");
          const entity = this.store.getEntity(entityId);
          if (!entity) return { found: false, entityId };
          await this.viewer.navigateToEntity(entity, { animate: args.animate !== false });
          return { found: true, entity: compactEntity(entity), selectedViewId: entity.bestViewIds[0] ?? null };
        }
      },
      {
        name: "find_semantic_route",
        description: "Find a route that respects accessibility, lift state, barriers, and capture evidence.",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Navigation node ID." },
            to: { type: "string", description: "Navigation node ID." },
            accessibleOnly: { type: "boolean", default: true }
          },
          required: ["from", "to"], additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async (args) => {
          const route = this.routePlanner.findRoute({
            from: ensureString(args.from, "from"),
            to: ensureString(args.to, "to"),
            accessibleOnly: args.accessibleOnly !== false
          });
          await this.viewer.setRoute(route.found ? route : null);
          if (route.found) await this.viewer.highlightEntities(route.entityIds);
          return route;
        }
      },
      {
        name: "set_entity_state",
        description: "Stage a reversible operational or scenario state change on one entity.",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", description: "Stable entity ID." },
            patch: { type: "object", description: "State fields to stage.", additionalProperties: { type: ["string", "number", "boolean"] } }
          },
          required: ["entityId", "patch"], additionalProperties: false
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
        execute: async (args) => {
          const change = this.store.setEntityState(ensureString(args.entityId, "entityId"), args.patch);
          await this.viewer.onScenarioChanged([change]);
          return { staged: true, change, stagedChangeCount: this.store.getScenarioHistory().length };
        }
      },
      {
        name: "undo_scene_change",
        description: "Undo the latest staged scene-state change.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
        execute: async () => {
          const change = this.store.undoLastChange();
          if (change) await this.viewer.onScenarioChanged([{ ...change, undone: true }]);
          return { undone: Boolean(change), change, stagedChangeCount: this.store.getScenarioHistory().length };
        }
      },
      {
        name: "get_region_quality",
        description: "Read task readiness, confidence dimensions, evidence gaps, and recommendations for a region.",
        inputSchema: {
          type: "object",
          properties: { regionId: { type: "string", description: "Stable region ID." } },
          required: ["regionId"], additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async (args) => {
          const regionId = ensureString(args.regionId, "regionId");
          const quality = this.store.getRegionQuality(regionId);
          if (!quality) return { found: false, regionId };
          await this.viewer.showQualityOverlay(quality);
          return { found: true, region: this.store.getRegion(regionId), quality };
        }
      },
      {
        name: "recommend_recapture",
        description: "Return concrete recapture poses for the evidence gaps in a region.",
        inputSchema: {
          type: "object",
          properties: { regionId: { type: "string", description: "Stable region ID." } },
          required: ["regionId"], additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async (args) => {
          const regionId = ensureString(args.regionId, "regionId");
          const quality = this.store.getRegionQuality(regionId);
          if (!quality) return { found: false, regionId };
          return {
            found: true,
            regionId,
            currentReadiness: quality.readiness,
            gapCount: quality.gaps.length,
            recommendations: quality.recommendations
          };
        }
      },
      {
        name: "list_uncertain_entities",
        description: "List entities with weak category, boundary, geometry, or capture confidence.",
        inputSchema: {
          type: "object",
          properties: { threshold: { type: "number", minimum: 0, maximum: 1, default: 0.75 } },
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async (args) => {
          const threshold = typeof args.threshold === "number" ? args.threshold : 0.75;
          const entities = this.store.listUncertainEntities(threshold);
          await this.viewer.highlightEntities(entities.map((entity) => entity.id));
          return { threshold, count: entities.length, entities };
        }
      }
    ];
  }
}
