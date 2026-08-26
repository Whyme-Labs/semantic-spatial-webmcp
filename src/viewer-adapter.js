// @ts-check

/**
 * Browser demo adapter. Replace this with a real 3DGS adapter without changing
 * the semantic tools.
 */
export class DemoViewerAdapter {
  constructor() {
    this.context = {
      cameraPose: { position: [8, 16, 1.6], target: [26, 15, 1.6] },
      currentRegionId: "entrance_a_zone",
      selectedEntityId: null,
      visibleEntityIds: ["entrance_a", "ticket_machine_1", "help_point_1"]
    };
  }

  async getContext() {
    return structuredClone(this.context);
  }

  async navigateToEntity(entity, options = {}) {
    this.context.selectedEntityId = entity.id;
    this.context.currentRegionId = entity.regionId;
    this.context.visibleEntityIds = [entity.id];
    window.dispatchEvent(new CustomEvent("spatial:navigate", { detail: { entity, options } }));
  }

  async highlightEntities(entityIds) {
    window.dispatchEvent(new CustomEvent("spatial:highlight", { detail: { entityIds } }));
  }

  async setRoute(route) {
    window.dispatchEvent(new CustomEvent("spatial:route", { detail: { route } }));
  }

  async showQualityOverlay(quality) {
    window.dispatchEvent(new CustomEvent("spatial:quality", { detail: { quality } }));
  }

  async onScenarioChanged(changes) {
    window.dispatchEvent(new CustomEvent("spatial:scenario", { detail: { changes } }));
  }
}

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

  async getContext() { return structuredClone(this.context); }
  async navigateToEntity(entity, options = {}) {
    this.lastNavigation = { entity: structuredClone(entity), options: structuredClone(options) };
    this.context.selectedEntityId = entity.id;
    this.context.currentRegionId = entity.regionId;
  }
  async highlightEntities(entityIds) { this.highlighted = [...entityIds]; }
  async setRoute(route) { this.route = structuredClone(route); }
  async showQualityOverlay(quality) { this.quality = structuredClone(quality); }
  async onScenarioChanged(changes) { this.changes.push(structuredClone(changes)); }
}
