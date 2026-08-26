// @ts-check

export class RoutePlanner {
  /**
   * @param {any} navigation
   * @param {import('./scene-store.js').SpatialSceneStore} store
   */
  constructor(navigation, store) {
    this.nodes = new Map(navigation.nodes.map((node) => [node.id, structuredClone(node)]));
    this.edges = [];
    for (const edge of navigation.edges) {
      this.edges.push(structuredClone(edge));
      if (edge.bidirectional !== false) {
        this.edges.push({ ...structuredClone(edge), from: edge.to, to: edge.from });
      }
    }
    this.store = store;
  }

  /** @param {any} edge @param {boolean} accessibleOnly */
  isEdgeAvailable(edge, accessibleOnly) {
    if (accessibleOnly && !edge.accessible) return false;
    if (edge.requiresOperationalEntityId && !this.store.isEntityOperational(edge.requiresOperationalEntityId)) return false;
    if (edge.blockedByEntityId && this.store.isEntityBlocking(edge.blockedByEntityId)) return false;
    return true;
  }

  /**
   * @param {{from:string,to:string,accessibleOnly?:boolean}} options
   */
  findRoute(options) {
    const { from, to, accessibleOnly = true } = options;
    if (!this.nodes.has(from)) throw new Error(`Unknown route origin: ${from}`);
    if (!this.nodes.has(to)) throw new Error(`Unknown route destination: ${to}`);

    const distance = new Map([...this.nodes.keys()].map((id) => [id, Number.POSITIVE_INFINITY]));
    const previous = new Map();
    const previousEdge = new Map();
    const unvisited = new Set(this.nodes.keys());
    distance.set(from, 0);

    while (unvisited.size) {
      let current = null;
      let currentDistance = Number.POSITIVE_INFINITY;
      for (const candidate of unvisited) {
        const candidateDistance = distance.get(candidate) ?? Number.POSITIVE_INFINITY;
        if (candidateDistance < currentDistance) {
          current = candidate;
          currentDistance = candidateDistance;
        }
      }

      if (current === null || currentDistance === Number.POSITIVE_INFINITY) break;
      unvisited.delete(current);
      if (current === to) break;

      for (const edge of this.edges) {
        if (edge.from !== current || !unvisited.has(edge.to)) continue;
        if (!this.isEdgeAvailable(edge, accessibleOnly)) continue;

        const modePenalty = accessibleOnly && edge.mode === "escalator" ? 1000 : 0;
        const alternate = currentDistance + edge.distance + modePenalty;
        if (alternate < (distance.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
          distance.set(edge.to, alternate);
          previous.set(edge.to, current);
          previousEdge.set(edge.to, edge);
        }
      }
    }

    if ((distance.get(to) ?? Number.POSITIVE_INFINITY) === Number.POSITIVE_INFINITY) {
      return {
        found: false,
        from,
        to,
        accessibleOnly,
        reason: "No route satisfies the current accessibility and operational constraints.",
        unavailableEntities: this.getUnavailableRouteEntities()
      };
    }

    const nodeIds = [];
    const routeEdges = [];
    let cursor = to;
    nodeIds.unshift(cursor);
    while (cursor !== from) {
      const edge = previousEdge.get(cursor);
      const prior = previous.get(cursor);
      if (!edge || !prior) throw new Error("Route reconstruction failed.");
      routeEdges.unshift(structuredClone(edge));
      cursor = prior;
      nodeIds.unshift(cursor);
    }

    const nodes = nodeIds.map((id) => structuredClone(this.nodes.get(id)));
    const warnings = this.buildQualityWarnings(routeEdges);
    const entityIds = [...new Set(nodes.flatMap((node) => node.entityIds))];

    return {
      found: true,
      from,
      to,
      accessibleOnly,
      distanceMeters: Number(distance.get(to).toFixed(1)),
      nodeIds,
      nodes,
      edges: routeEdges,
      entityIds,
      warnings,
      summary: this.summarize(nodes, routeEdges, warnings)
    };
  }

  /** @param {any[]} edges */
  buildQualityWarnings(edges) {
    const regionIds = [...new Set(edges.map((edge) => edge.regionId))];
    const warnings = [];
    for (const regionId of regionIds) {
      const quality = this.store.getRegionQuality(regionId);
      if (!quality) continue;
      if (quality.readiness.accessibleWayfinding < 0.75 || quality.gaps.some((gap) => gap.severity === "blocking")) {
        warnings.push({
          regionId,
          label: this.store.getRegion(regionId)?.label ?? regionId,
          readiness: quality.readiness.accessibleWayfinding,
          gaps: quality.gaps
        });
      }
    }
    return warnings;
  }

  /** @param {any[]} nodes @param {any[]} edges @param {any[]} warnings */
  summarize(nodes, edges, warnings) {
    const modes = [...new Set(edges.map((edge) => edge.mode))];
    const path = nodes.map((node) => node.label).join(" → ");
    const warningText = warnings.length
      ? ` Evidence warning in ${warnings.map((warning) => warning.label).join(", ")}.`
      : " Capture evidence is sufficient along the route.";
    return `${path}. Modes: ${modes.join(", ")}.${warningText}`;
  }

  getUnavailableRouteEntities() {
    const ids = new Set();
    for (const edge of this.edges) {
      if (edge.requiresOperationalEntityId && !this.store.isEntityOperational(edge.requiresOperationalEntityId)) {
        ids.add(edge.requiresOperationalEntityId);
      }
      if (edge.blockedByEntityId && this.store.isEntityBlocking(edge.blockedByEntityId)) {
        ids.add(edge.blockedByEntityId);
      }
    }
    return [...ids];
  }
}
