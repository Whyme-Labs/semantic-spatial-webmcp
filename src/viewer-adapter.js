// @ts-check

import { throwIfAborted } from "./schema-validator.js";

/**
 * Browser adapter that keeps semantic context stable while delegating visual
 * work to a renderer bridge. The bridge can be Spark, PlayCanvas, or any other
 * implementation with the same small method set.
 */
export class BrowserSpatialViewerAdapter {
  /**
   * @param {{bridge?:any,store?:any,eventTarget?:EventTarget|null}=} options
   */
  constructor(options = {}) {
    this.bridge = options.bridge ?? null;
    this.store = options.store ?? null;
    this.eventTarget = options.eventTarget ?? (typeof window === "undefined" ? null : window);
    this.context = {
      cameraPose: { position: [8, 16, 1.6], target: [26, 15, 1.6] },
      currentRegionId: "entrance_a_zone",
      selectedEntityId: null,
      visibleEntityIds: ["entrance_a", "ticket_machine_1", "help_point_1"]
    };
  }

  /** @param {any} bridge */
  attachBridge(bridge) {
    this.bridge = bridge;
  }

  /** @param {string} name @param {any} detail */
  emit(name, detail) {
    if (!this.eventTarget || typeof CustomEvent === "undefined") return;
    this.eventTarget.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /** @param {{signal?:AbortSignal}=} options */
  async getContext(options = {}) {
    throwIfAborted(options.signal);
    if (this.bridge?.getContext) {
      const liveContext = await this.bridge.getContext(options);
      throwIfAborted(options.signal);
      this.context = {
        ...this.context,
        ...liveContext,
        selectedEntityId: Object.hasOwn(liveContext, "selectedEntityId") ? liveContext.selectedEntityId : this.context.selectedEntityId,
        currentRegionId: Object.hasOwn(liveContext, "currentRegionId") ? liveContext.currentRegionId : this.context.currentRegionId
      };
    }
    return structuredClone(this.context);
  }

  async navigateToEntity(entity, options = {}) {
    throwIfAborted(options.signal);
    const navigation = await this.bridge?.navigateToEntity?.(entity, options);
    throwIfAborted(options.signal);
    this.context.selectedEntityId = entity.id;
    this.context.currentRegionId = entity.regionId;
    this.context.visibleEntityIds = [entity.id];
    this.emit("spatial:navigate", { entity, options });
    return navigation ?? { selectedViewId: null };
  }

  async highlightEntities(entityIds, options = {}) {
    throwIfAborted(options.signal);
    await this.bridge?.highlightEntities?.(entityIds, options);
    throwIfAborted(options.signal);
    this.emit("spatial:highlight", { entityIds });
  }

  async setRoute(route, options = {}) {
    throwIfAborted(options.signal);
    await this.bridge?.setRoute?.(route, options);
    throwIfAborted(options.signal);
    this.emit("spatial:route", { route });
  }

  async showQualityOverlay(quality, options = {}) {
    throwIfAborted(options.signal);
    await this.bridge?.showQualityOverlay?.(quality, options);
    throwIfAborted(options.signal);
    this.emit("spatial:quality", { quality });
  }

  async onScenarioChanged(changes, options = {}) {
    throwIfAborted(options.signal);
    if (this.bridge?.syncEntityState && this.store) {
      const entityIds = changes.length
        ? [...new Set(changes.map((change) => change.entityId))]
        : this.store.scene.entities.map((entity) => entity.id);
      for (const entityId of entityIds) {
        throwIfAborted(options.signal);
        const entity = this.store.getEntity(entityId);
        if (entity) await this.bridge.syncEntityState(entity, options);
      }
    }
    throwIfAborted(options.signal);
    this.emit("spatial:scenario", { changes });
  }
}

export class DemoViewerAdapter extends BrowserSpatialViewerAdapter {}

/**
 * No-DOM adapter used by tests and server-side evaluation.
 */
export class MemoryViewerAdapter {
  constructor() {
    this.context = {
      cameraPose: null,
      currentRegionId: "entrance_a_zone",
      selectedEntityId: null,
      visibleEntityIds: []
    };
    this.lastNavigation = null;
    this.highlighted = [];
    this.route = null;
    this.quality = null;
    this.changes = [];
  }

  async getContext(options = {}) {
    throwIfAborted(options.signal);
    return structuredClone(this.context);
  }
  async navigateToEntity(entity, options = {}) {
    throwIfAborted(options.signal);
    this.lastNavigation = { entity: structuredClone(entity), options: structuredClone(options) };
    this.context.selectedEntityId = entity.id;
    this.context.currentRegionId = entity.regionId;
    return { selectedViewId: null };
  }
  async highlightEntities(entityIds, options = {}) {
    throwIfAborted(options.signal);
    this.highlighted = [...entityIds];
  }
  async setRoute(route, options = {}) {
    throwIfAborted(options.signal);
    this.route = structuredClone(route);
  }
  async showQualityOverlay(quality, options = {}) {
    throwIfAborted(options.signal);
    this.quality = structuredClone(quality);
  }
  async onScenarioChanged(changes, options = {}) {
    throwIfAborted(options.signal);
    this.changes.push(structuredClone(changes));
  }
}
