// @ts-check

import { RoutePlanner } from "./route-planner.js";
import { assertPlainJson, assertSchema, throwIfAborted } from "./schema-validator.js";

export const TOOL_OUTPUT_CHARACTER_BUDGET = 1450;

/** @param {any} entity */
const entitySummary = (entity) => ({
  id: entity.id,
  label: entity.label,
  type: entity.type,
  regionId: entity.regionId,
  state: entity.state
});

/** @param {any} entity @param {any[]=} relations */
const entityDetail = (entity, relations = []) => ({
  ...entitySummary(entity),
  position: entity.position,
  tags: entity.tags,
  description: entity.description,
  confidence: entity.confidence,
  bestViewIds: entity.bestViewIds,
  relations: relations.map(({ subjectId, predicate, objectId, confidence }) => ({ subjectId, predicate, objectId, confidence }))
});

/** @param {any} region */
const regionSummary = (region) => region ? ({ id: region.id, label: region.label, type: region.type, floor: region.floor }) : null;

/** @param {unknown} value */
function cloneForEvent(value) {
  try {
    return structuredClone(value);
  } catch {
    return null;
  }
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export class SpatialToolRuntime {
  /**
   * @param {import('./scene-store.js').SpatialSceneStore} store
   * @param {any} viewer
   */
  constructor(store, viewer) {
    this.store = store;
    this.viewer = viewer;
    this.routePlanner = new RoutePlanner(store.scene.navigation, store);
    this.listeners = new Set();
    this.nextInvocationId = 1;
    this.tools = this.buildTools();
    this.toolMap = new Map(this.tools.map((tool) => [tool.name, tool]));
  }

  listTools() {
    return this.tools.map(({ execute, ...definition }) => structuredClone(definition));
  }

  /** @param {(event:any) => void} listener */
  observe(listener) {
    if (typeof listener !== "function") throw new TypeError("Observer must be a function.");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** @param {any} event */
  emit(event) {
    for (const listener of this.listeners) {
      try {
        listener(structuredClone(event));
      } catch (error) {
        console.error("Spatial tool observer failed.", error);
      }
    }
  }

  /**
   * @param {string} name
   * @param {unknown=} args
   * @param {{source?:string,signal?:AbortSignal}=} options
   */
  async invoke(name, args = {}, options = {}) {
    const source = options.source ?? "local";
    const invocationId = `invocation_${this.nextInvocationId++}`;
    this.emit({
      type: "invocation-start",
      phase: "start",
      invocationId,
      tool: name,
      source,
      args: cloneForEvent(args)
    });

    try {
      throwIfAborted(options.signal);
      const tool = this.toolMap.get(name);
      if (!tool) throw new Error(`Unknown tool: ${name}`);
      assertPlainJson(args, "input");
      assertSchema(args, tool.inputSchema);
      const result = await tool.execute(args, { source, signal: options.signal });
      throwIfAborted(options.signal);
      assertPlainJson(result);
      const encoded = JSON.stringify(result);
      if (encoded.length > TOOL_OUTPUT_CHARACTER_BUDGET) {
        throw new RangeError(`${name} output exceeds the ${TOOL_OUTPUT_CHARACTER_BUDGET}-character budget.`);
      }
      const detachedResult = JSON.parse(encoded);
      this.emit({
        type: "invocation-end",
        phase: "terminal",
        status: "success",
        invocationId,
        tool: name,
        source,
        result: detachedResult
      });
      return detachedResult;
    } catch (error) {
      this.emit({
        type: "invocation-end",
        phase: "terminal",
        status: options.signal?.aborted || (error instanceof Error && error.name === "AbortError") ? "cancelled" : "error",
        invocationId,
        tool: name,
        source,
        error: errorMessage(error)
      });
      throw error;
    }
  }

  /** @param {string} reference @param {"origin"|"destination"} role */
  resolveRouteEndpoint(reference, role) {
    const normalized = reference.trim().toLowerCase();
    const nodes = this.store.scene.navigation.nodes;
    const matches = new Map();
    const add = (node) => matches.set(node.id, node);

    const privateNode = nodes.find((node) => node.id === reference);
    if (privateNode) add(privateNode);
    for (const node of nodes) {
      if (node.label.toLowerCase() === normalized) add(node);
    }

    const matchingRegions = this.store.scene.regions.filter((region) =>
      region.id.toLowerCase() === normalized || region.label.toLowerCase() === normalized
    );
    for (const region of matchingRegions) {
      for (const node of nodes.filter((candidate) => candidate.regionId === region.id)) add(node);
    }

    const matchingEntities = this.store.scene.entities.filter((entity) =>
      entity.id.toLowerCase() === normalized
      || entity.label.toLowerCase() === normalized
      || entity.aliases.some((alias) => alias.toLowerCase() === normalized)
    );
    for (const entity of matchingEntities) {
      for (const node of nodes.filter((candidate) => candidate.entityIds.includes(entity.id))) add(node);
    }

    const resolved = [...matches.values()];
    if (resolved.length === 0) throw new Error(`Unknown route ${role}: ${reference}`);
    if (resolved.length > 1) {
      throw new Error(`Ambiguous route ${role}: ${reference}. Use one of: ${resolved.map((node) => node.label).join(", ")}.`);
    }
    return resolved[0];
  }

  /** @param {any} route @param {any} fromNode @param {any} toNode */
  publicRoute(route, fromNode, toNode) {
    const endpoint = (node) => ({ label: node.label, regionId: node.regionId, entityIds: node.entityIds });
    if (!route.found) {
      return {
        found: false,
        from: endpoint(fromNode),
        to: endpoint(toNode),
        accessibleOnly: route.accessibleOnly,
        reason: route.reason,
        unavailableEntities: route.unavailableEntities
      };
    }
    return {
      found: true,
      from: endpoint(fromNode),
      to: endpoint(toNode),
      accessibleOnly: route.accessibleOnly,
      distanceMeters: route.distanceMeters,
      steps: route.nodes.map((node) => ({ label: node.label, regionId: node.regionId, point: node.point })),
      modes: [...new Set(route.edges.map((edge) => edge.mode))],
      entityIds: route.entityIds,
      warnings: route.warnings.map((warning) => ({
        regionId: warning.regionId,
        label: warning.label,
        readiness: warning.readiness,
        gaps: warning.gaps.map(({ kind, severity }) => ({ kind, severity }))
      })),
      summary: route.summary
    };
  }

  /** @param {any} entity @param {Record<string,unknown>} patch */
  assertSupportedStatePatch(entity, patch) {
    for (const key of Object.keys(patch)) {
      if (!Object.hasOwn(entity.state, key)) throw new TypeError(`${entity.id} does not support state field: ${key}.`);
    }
  }

  connectedRegionSummaries(regionId) {
    if (!regionId) return [];
    const nodes = this.store.scene.navigation.nodes;
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const localNodeIds = new Set(nodes.filter((node) => node.regionId === regionId).map((node) => node.id));
    const connectedRegionIds = new Set();
    for (const edge of this.store.scene.navigation.edges) {
      if (localNodeIds.has(edge.from)) connectedRegionIds.add(nodeById.get(edge.to)?.regionId);
      if (localNodeIds.has(edge.to)) connectedRegionIds.add(nodeById.get(edge.from)?.regionId);
    }
    connectedRegionIds.delete(regionId);
    connectedRegionIds.delete(undefined);
    return [...connectedRegionIds]
      .map((id) => regionSummary(this.store.getRegion(id)))
      .filter(Boolean)
      .slice(0, 6);
  }

  evidenceViewsForQuality(quality) {
    const viewIds = new Set(quality.gaps.flatMap((gap) => {
      const entity = gap.entityId ? this.store.getEntity(gap.entityId) : null;
      return entity?.bestViewIds ?? [];
    }));
    return this.store.scene.evidenceViews
      .filter((view) => viewIds.has(view.id))
      .map(({ id, entityId, visibility, imageQuality, pose }) => ({ id, entityId, visibility, imageQuality, pose }));
  }

  async syncScenarioAndClearDerivedOverlays(changes, signal) {
    await this.viewer.onScenarioChanged(changes, { signal });
    await this.viewer.setRoute(null, { signal });
    await this.viewer.showQualityOverlay(null, { signal });
  }

  buildTools() {
    return [
      {
        name: "get_scene_context",
        description: "Read live camera, current region, selection, visible and nearby hidden entities, connected spaces, and staged changes.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async (_args, { signal }) => {
          const context = await this.viewer.getContext({ signal });
          const selected = context.selectedEntityId ? this.store.getEntity(context.selectedEntityId) : null;
          const anchorRegionId = context.currentRegionId ?? selected?.regionId ?? null;
          const visibleEntityIds = new Set(context.visibleEntityIds);
          return {
            scene: { id: this.store.scene.id, label: this.store.scene.label },
            cameraPose: context.cameraPose,
            currentRegion: regionSummary(context.currentRegionId ? this.store.getRegion(context.currentRegionId) : null),
            selectedEntity: selected ? entitySummary(selected) : null,
            visibleEntities: context.visibleEntityIds
              .map((id) => this.store.getEntity(id))
              .filter(Boolean)
              .map(({ id, label, type }) => ({ id, label, type })),
            nearbyHiddenEntities: anchorRegionId
              ? this.store.scene.entities
                .filter((entity) => entity.regionId === anchorRegionId && !visibleEntityIds.has(entity.id))
                .slice(0, 5)
                .map(({ id, label, type }) => ({ id, label, type }))
              : [],
            connectedSpaces: this.connectedRegionSummaries(anchorRegionId),
            stagedChangeCount: this.store.getScenarioHistory().length
          };
        }
      },
      {
        name: "search_entities",
        description: "Search scene objects by text, exact type, region, or required tags and highlight the matches.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", maxLength: 120, description: "Words describing the object." },
            type: { type: "string", maxLength: 60, description: "Optional exact entity type." },
            regionId: { type: "string", maxLength: 80, description: "Optional public region ID." },
            tags: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: 8, description: "Required tags." },
            limit: { type: "integer", minimum: 1, maximum: 10, default: 10, description: "Maximum matches, from 1 to 10." }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (args, { signal }) => {
          const results = this.store.searchEntities(args);
          await this.viewer.highlightEntities(results.map((result) => result.id), { signal });
          return {
            count: results.length,
            results: results.map((result) => ({
              id: result.id,
              label: result.label,
              type: result.type,
              regionId: result.regionId,
              confidence: Math.min(...Object.values(result.confidence))
            }))
          };
        }
      },
      {
        name: "get_entity",
        description: "Read one spatial entity, including state, confidence, region, and relationships.",
        inputSchema: {
          type: "object",
          properties: { entityId: { type: "string", minLength: 1, maxLength: 100, description: "Stable public entity ID." } },
          required: ["entityId"], additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async (args) => {
          const entityId = args.entityId.trim();
          const entity = this.store.getEntity(entityId);
          if (!entity) return { found: false, entityId };
          return { found: true, entity: entityDetail(entity, this.store.getRelations(entity.id)), region: regionSummary(this.store.getRegion(entity.regionId)) };
        }
      },
      {
        name: "navigate_to_entity",
        description: "Move the shared viewer to the best known view of a scene entity.",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", minLength: 1, maxLength: 100, description: "Stable public entity ID." },
            animate: { type: "boolean", default: true, description: "Animate the camera move." }
          },
          required: ["entityId"], additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async (args, { signal }) => {
          const entityId = args.entityId.trim();
          const entity = this.store.getEntity(entityId);
          if (!entity) return { found: false, entityId };
          const navigation = await this.viewer.navigateToEntity(entity, { animate: args.animate !== false, signal });
          return { found: true, entity: entitySummary(entity), selectedViewId: navigation?.selectedViewId ?? null };
        }
      },
      {
        name: "find_semantic_route",
        description: "Find and draw a route between public place labels, aliases, entity IDs, or region IDs.",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", minLength: 1, maxLength: 120, description: "Origin such as Entrance A or main entrance." },
            to: { type: "string", minLength: 1, maxLength: 120, description: "Destination such as Platform 2." },
            accessibleOnly: { type: "boolean", default: true, description: "Use only accessible route segments." }
          },
          required: ["from", "to"], additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async (args, { signal }) => {
          const fromNode = this.resolveRouteEndpoint(args.from, "origin");
          const toNode = this.resolveRouteEndpoint(args.to, "destination");
          const route = this.routePlanner.findRoute({ from: fromNode.id, to: toNode.id, accessibleOnly: args.accessibleOnly !== false });
          await this.viewer.setRoute(route.found ? route : null, { signal });
          if (route.found) await this.viewer.highlightEntities(route.entityIds, { signal });
          return this.publicRoute(route, fromNode, toNode);
        }
      },
      {
        name: "set_entity_state",
        description: "Stage a reversible operational or scenario-state change and update the shared scene.",
        inputSchema: {
          type: "object",
          properties: {
            entityId: { type: "string", minLength: 1, maxLength: 100, description: "Stable public entity ID." },
            patch: {
              type: "object",
              description: "Supported state fields to stage.",
              properties: {
                operational: { type: "string", enum: ["open", "closed", "unavailable"] },
                active: { type: "boolean" },
                blocking: { type: "boolean" }
              },
              minProperties: 1,
              additionalProperties: false
            }
          },
          required: ["entityId", "patch"], additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async (args, { signal }) => {
          const entityId = args.entityId.trim();
          const entity = this.store.getEntity(entityId);
          if (!entity) throw new Error(`Unknown entity: ${entityId}`);
          this.assertSupportedStatePatch(entity, args.patch);
          throwIfAborted(signal);
          const change = this.store.setEntityState(entityId, args.patch);
          await this.syncScenarioAndClearDerivedOverlays([change], signal);
          return {
            staged: true,
            change: { id: change.id, entityId: change.entityId, before: change.before, after: change.after },
            stagedChangeCount: this.store.getScenarioHistory().length
          };
        }
      },
      {
        name: "undo_scene_change",
        description: "Undo the latest staged scene-state change and update the shared scene.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: async (_args, { signal }) => {
          throwIfAborted(signal);
          const change = this.store.undoLastChange();
          if (change) {
            await this.syncScenarioAndClearDerivedOverlays([{ ...change, undone: true }], signal);
          }
          return {
            undone: Boolean(change),
            change: change ? { id: change.id, entityId: change.entityId, before: change.before, after: change.after } : null,
            stagedChangeCount: this.store.getScenarioHistory().length
          };
        }
      },
      {
        name: "get_region_quality",
        description: "Show a region's readiness, confidence dimensions, evidence gaps, and recapture guidance.",
        inputSchema: {
          type: "object",
          properties: { regionId: { type: "string", minLength: 1, maxLength: 100, description: "Stable public region ID." } },
          required: ["regionId"], additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async (args, { signal }) => {
          const regionId = args.regionId.trim();
          const quality = this.store.getRegionQuality(regionId);
          if (!quality) return { found: false, regionId };
          const evidenceViews = this.evidenceViewsForQuality(quality);
          const presentation = { ...quality, evidenceViews };
          await this.viewer.highlightEntities(quality.gaps.map((gap) => gap.entityId).filter(Boolean), { signal });
          await this.viewer.showQualityOverlay(presentation, { signal });
          return {
            found: true,
            region: regionSummary(this.store.getRegion(regionId)),
            quality: {
              readiness: quality.readiness,
              dimensions: quality.dimensions,
              gaps: quality.gaps.map(({ id, kind, entityId, severity, explanation }) => ({
                id,
                kind,
                ...(entityId ? { entityId } : {}),
                severity,
                explanation
              })),
              evidenceViews: evidenceViews.map(({ id, entityId, visibility, imageQuality }) => ({ id, entityId, visibility, imageQuality })),
              recommendations: quality.recommendations.map(({ id, instruction, pose, expectedImprovement }) => ({ id, instruction, pose, expectedImprovement }))
            }
          };
        }
      },
      {
        name: "list_uncertain_entities",
        description: "Highlight entities below a confidence threshold and list their weakest evidence dimension.",
        inputSchema: {
          type: "object",
          properties: {
            threshold: { type: "number", minimum: 0, maximum: 1, default: 0.75, description: "Confidence cutoff from 0 to 1." },
            limit: { type: "integer", minimum: 1, maximum: 10, default: 10, description: "Maximum results, from 1 to 10." }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async (args, { signal }) => {
          const threshold = args.threshold ?? 0.75;
          const entities = this.store.listUncertainEntities(threshold).slice(0, args.limit ?? 10);
          await this.viewer.highlightEntities(entities.map((entity) => entity.id), { signal });
          return {
            threshold,
            count: entities.length,
            entities: entities.map((entity) => ({
              id: entity.id,
              label: entity.label,
              regionId: entity.regionId,
              weakestDimension: entity.weakestDimension,
              confidence: entity.confidence[entity.weakestDimension]
            }))
          };
        }
      },
      {
        name: "reset_scene",
        description: "Restore baseline scene state and clear route, quality, and scenario overlays.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: async (_args, { signal }) => {
          throwIfAborted(signal);
          const undone = this.store.resetScenario();
          await this.syncScenarioAndClearDerivedOverlays([], signal);
          return { reset: true, undoneChangeCount: undone.length, stagedChangeCount: 0 };
        }
      }
    ];
  }
}
