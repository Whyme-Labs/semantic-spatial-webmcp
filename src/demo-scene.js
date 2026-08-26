// @ts-check

export const demoScene = {
  id: "mrt_demo_station",
  label: "Harbour Junction Station",
  regions: [
    { id: "station", type: "site", label: "Harbour Junction Station", parentId: null, floor: 0, mapBounds: { x: 0, y: 0, width: 100, height: 70 } },
    { id: "concourse_floor", type: "floor", label: "Concourse", parentId: "station", floor: 0, mapBounds: { x: 2, y: 3, width: 96, height: 28 } },
    { id: "platform_floor", type: "floor", label: "Platform level", parentId: "station", floor: 1, mapBounds: { x: 2, y: 38, width: 96, height: 28 } },
    { id: "entrance_a_zone", type: "zone", label: "Entrance A", parentId: "concourse_floor", floor: 0, mapBounds: { x: 4, y: 10, width: 14, height: 12 } },
    { id: "ticketing_zone", type: "zone", label: "Ticketing concourse", parentId: "concourse_floor", floor: 0, mapBounds: { x: 19, y: 8, width: 24, height: 16 } },
    { id: "east_corridor", type: "zone", label: "East corridor", parentId: "concourse_floor", floor: 0, mapBounds: { x: 44, y: 8, width: 22, height: 8 } },
    { id: "west_corridor", type: "zone", label: "West corridor", parentId: "concourse_floor", floor: 0, mapBounds: { x: 44, y: 18, width: 31, height: 8 } },
    { id: "vertical_core_east", type: "zone", label: "East vertical core", parentId: "concourse_floor", floor: 0, mapBounds: { x: 67, y: 7, width: 12, height: 10 } },
    { id: "vertical_core_west", type: "zone", label: "West vertical core", parentId: "concourse_floor", floor: 0, mapBounds: { x: 76, y: 18, width: 12, height: 10 } },
    { id: "platform_2_zone", type: "zone", label: "Platform 2", parentId: "platform_floor", floor: 1, mapBounds: { x: 18, y: 43, width: 70, height: 17 } },
    { id: "platform_east_lobby", type: "zone", label: "Platform east lift lobby", parentId: "platform_floor", floor: 1, mapBounds: { x: 67, y: 43, width: 12, height: 10 } },
    { id: "platform_west_lobby", type: "zone", label: "Platform west lift lobby", parentId: "platform_floor", floor: 1, mapBounds: { x: 76, y: 52, width: 12, height: 10 } }
  ],
  entities: [
    {
      id: "entrance_a", type: "entrance", label: "Entrance A", aliases: ["main entrance"], regionId: "entrance_a_zone",
      position: [8, 16, 0], tags: ["public", "accessible", "portal"], description: "Street-level accessible entrance.",
      state: { operational: "open" }, confidence: { category: 1, boundary: 0.98, geometry: 0.98, coverage: 0.99, freshness: 0.99 }, bestViewIds: ["view_entrance_a"]
    },
    {
      id: "ticket_machine_1", type: "ticket_machine", label: "Ticket machine 1", aliases: ["ticket kiosk", "fare machine"], regionId: "ticketing_zone",
      position: [24, 13, 0], tags: ["ticketing", "public"], description: "General ticket and stored-value machine.",
      state: { operational: "open" }, confidence: { category: 0.99, boundary: 0.93, geometry: 0.92, coverage: 0.96, freshness: 0.98 }, bestViewIds: ["view_ticket_machine_1"]
    },
    {
      id: "help_point_1", type: "help_point", label: "Customer help point", aliases: ["help desk", "service counter"], regionId: "ticketing_zone",
      position: [29, 20, 0], tags: ["assistance", "staffed", "accessible"], description: "Staffed customer assistance point.",
      state: { operational: "open" }, confidence: { category: 0.98, boundary: 0.88, geometry: 0.91, coverage: 0.95, freshness: 0.98 }, bestViewIds: ["view_help_point_1"]
    },
    {
      id: "accessible_gate_1", type: "fare_gate", label: "Accessible fare gate", aliases: ["wide gate", "wheelchair gate"], regionId: "ticketing_zone",
      position: [39, 15, 0], tags: ["accessible", "ticketing", "portal"], description: "Wide fare gate suitable for wheelchairs and luggage.",
      state: { operational: "open" }, confidence: { category: 1, boundary: 0.96, geometry: 0.97, coverage: 0.98, freshness: 0.99 }, bestViewIds: ["view_accessible_gate_1"]
    },
    {
      id: "lift_1", type: "lift", label: "Lift 1", aliases: ["east lift", "main lift"], regionId: "vertical_core_east",
      position: [72, 12, 0], tags: ["accessible", "vertical-circulation"], description: "Primary accessible lift between concourse and Platform 2.",
      state: { operational: "open" }, confidence: { category: 1, boundary: 0.94, geometry: 0.96, coverage: 0.95, freshness: 0.99 }, bestViewIds: ["view_lift_1"]
    },
    {
      id: "lift_2", type: "lift", label: "Lift 2", aliases: ["west lift", "alternate lift"], regionId: "vertical_core_west",
      position: [82, 23, 0], tags: ["accessible", "vertical-circulation"], description: "Alternate accessible lift between concourse and Platform 2.",
      state: { operational: "open" }, confidence: { category: 0.99, boundary: 0.91, geometry: 0.94, coverage: 0.84, freshness: 0.99 }, bestViewIds: ["view_lift_2"]
    },
    {
      id: "escalator_1", type: "escalator", label: "Escalator 1", aliases: ["up escalator"], regionId: "vertical_core_east",
      position: [76, 12, 0], tags: ["vertical-circulation", "not-wheelchair-accessible"], description: "Escalator to platform level.",
      state: { operational: "open" }, confidence: { category: 1, boundary: 0.97, geometry: 0.96, coverage: 0.97, freshness: 0.99 }, bestViewIds: ["view_escalator_1"]
    },
    {
      id: "bench_1", type: "bench", label: "Platform bench 1", aliases: ["seat", "seating"], regionId: "platform_2_zone",
      position: [42, 53, 1], tags: ["seating", "public"], description: "Four-seat platform bench.",
      state: { operational: "open" }, confidence: { category: 0.99, boundary: 0.95, geometry: 0.96, coverage: 0.98, freshness: 0.99 }, bestViewIds: ["view_bench_1"]
    },
    {
      id: "bench_2", type: "bench", label: "Platform bench 2", aliases: ["seat", "seating"], regionId: "platform_2_zone",
      position: [57, 53, 1], tags: ["seating", "public"], description: "Four-seat platform bench.",
      state: { operational: "open" }, confidence: { category: 0.99, boundary: 0.95, geometry: 0.96, coverage: 0.97, freshness: 0.99 }, bestViewIds: ["view_bench_2"]
    },
    {
      id: "sign_west_platform", type: "directional_sign", label: "West corridor platform sign", aliases: ["platform direction sign", "wayfinding sign"], regionId: "west_corridor",
      position: [68, 22, 0], tags: ["wayfinding", "platform-2"], description: "Directional sign near the alternate route to Lift 2.",
      state: { operational: "open" }, confidence: { category: 0.74, boundary: 0.69, geometry: 0.89, coverage: 0.43, freshness: 0.98 }, bestViewIds: ["view_sign_west_oblique"]
    },
    {
      id: "barrier_east", type: "temporary_barrier", label: "East corridor barrier", aliases: ["temporary barrier", "construction barrier"], regionId: "east_corridor",
      position: [56, 12, 0], tags: ["temporary", "blocking"], description: "A reversible scenario object that can block the east corridor.",
      state: { active: false }, confidence: { category: 1, boundary: 1, geometry: 1, coverage: 1, freshness: 1 }, bestViewIds: ["view_east_barrier"]
    }
  ],
  relations: [
    { subjectId: "entrance_a", predicate: "inside", objectId: "entrance_a_zone", confidence: 1, evidenceIds: ["view_entrance_a"] },
    { subjectId: "ticket_machine_1", predicate: "inside", objectId: "ticketing_zone", confidence: 1, evidenceIds: ["view_ticket_machine_1"] },
    { subjectId: "help_point_1", predicate: "inside", objectId: "ticketing_zone", confidence: 1, evidenceIds: ["view_help_point_1"] },
    { subjectId: "accessible_gate_1", predicate: "inside", objectId: "ticketing_zone", confidence: 1, evidenceIds: ["view_accessible_gate_1"] },
    { subjectId: "accessible_gate_1", predicate: "near", objectId: "help_point_1", confidence: 0.97, evidenceIds: ["geometry"] },
    { subjectId: "lift_1", predicate: "connects", objectId: "platform_east_lobby", confidence: 1, evidenceIds: ["route_graph"] },
    { subjectId: "lift_2", predicate: "connects", objectId: "platform_west_lobby", confidence: 1, evidenceIds: ["route_graph"] },
    { subjectId: "bench_1", predicate: "inside", objectId: "platform_2_zone", confidence: 1, evidenceIds: ["view_bench_1"] },
    { subjectId: "bench_2", predicate: "inside", objectId: "platform_2_zone", confidence: 1, evidenceIds: ["view_bench_2"] },
    { subjectId: "sign_west_platform", predicate: "inside", objectId: "west_corridor", confidence: 1, evidenceIds: ["view_sign_west_oblique"] },
    { subjectId: "barrier_east", predicate: "blocks_when_active", objectId: "east_corridor", confidence: 1, evidenceIds: ["scenario"] }
  ],
  navigation: {
    nodes: [
      { id: "n_entrance", label: "Entrance A", regionId: "entrance_a_zone", point: { x: 8, y: 16, floor: 0 }, entityIds: ["entrance_a"] },
      { id: "n_ticketing", label: "Ticketing concourse", regionId: "ticketing_zone", point: { x: 26, y: 15, floor: 0 }, entityIds: ["ticket_machine_1", "help_point_1"] },
      { id: "n_gate", label: "Accessible fare gate", regionId: "ticketing_zone", point: { x: 39, y: 15, floor: 0 }, entityIds: ["accessible_gate_1"] },
      { id: "n_east_mid", label: "East corridor", regionId: "east_corridor", point: { x: 55, y: 12, floor: 0 }, entityIds: ["barrier_east"] },
      { id: "n_lift1_lower", label: "Lift 1 concourse", regionId: "vertical_core_east", point: { x: 72, y: 12, floor: 0 }, entityIds: ["lift_1"] },
      { id: "n_lift1_upper", label: "Lift 1 platform", regionId: "platform_east_lobby", point: { x: 72, y: 47, floor: 1 }, entityIds: ["lift_1"] },
      { id: "n_west_mid", label: "West corridor", regionId: "west_corridor", point: { x: 58, y: 22, floor: 0 }, entityIds: ["sign_west_platform"] },
      { id: "n_lift2_lower", label: "Lift 2 concourse", regionId: "vertical_core_west", point: { x: 82, y: 23, floor: 0 }, entityIds: ["lift_2"] },
      { id: "n_lift2_upper", label: "Lift 2 platform", regionId: "platform_west_lobby", point: { x: 82, y: 57, floor: 1 }, entityIds: ["lift_2"] },
      { id: "n_platform", label: "Platform 2", regionId: "platform_2_zone", point: { x: 50, y: 52, floor: 1 }, entityIds: ["bench_1", "bench_2"] }
    ],
    edges: [
      { from: "n_entrance", to: "n_ticketing", distance: 18, accessible: true, mode: "walk", regionId: "entrance_a_zone", bidirectional: true },
      { from: "n_ticketing", to: "n_gate", distance: 13, accessible: true, mode: "walk", regionId: "ticketing_zone", bidirectional: true },
      { from: "n_gate", to: "n_east_mid", distance: 17, accessible: true, mode: "walk", regionId: "east_corridor", blockedByEntityId: "barrier_east", bidirectional: true },
      { from: "n_east_mid", to: "n_lift1_lower", distance: 17, accessible: true, mode: "walk", regionId: "east_corridor", blockedByEntityId: "barrier_east", bidirectional: true },
      { from: "n_lift1_lower", to: "n_lift1_upper", distance: 8, accessible: true, mode: "lift", regionId: "vertical_core_east", requiresOperationalEntityId: "lift_1", bidirectional: true },
      { from: "n_lift1_upper", to: "n_platform", distance: 24, accessible: true, mode: "walk", regionId: "platform_2_zone", bidirectional: true },
      { from: "n_gate", to: "n_west_mid", distance: 22, accessible: true, mode: "walk", regionId: "west_corridor", bidirectional: true },
      { from: "n_west_mid", to: "n_lift2_lower", distance: 24, accessible: true, mode: "walk", regionId: "west_corridor", bidirectional: true },
      { from: "n_lift2_lower", to: "n_lift2_upper", distance: 8, accessible: true, mode: "lift", regionId: "vertical_core_west", requiresOperationalEntityId: "lift_2", bidirectional: true },
      { from: "n_lift2_upper", to: "n_platform", distance: 32, accessible: true, mode: "walk", regionId: "platform_2_zone", bidirectional: true }
    ]
  },
  quality: [
    {
      regionId: "east_corridor",
      readiness: { generalExploration: 0.95, accessibleWayfinding: 0.93 },
      dimensions: { coverage: 0.94, visual: 0.92, geometry: 0.96, semantics: 0.95, freshness: 0.99 },
      gaps: [], recommendations: []
    },
    {
      regionId: "west_corridor",
      readiness: { generalExploration: 0.78, accessibleWayfinding: 0.56 },
      dimensions: { coverage: 0.62, visual: 0.55, geometry: 0.88, semantics: 0.71, freshness: 0.98 },
      gaps: [
        {
          id: "gap_west_sign",
          kind: "unreadable_label",
          entityId: "sign_west_platform",
          severity: "blocking",
          explanation: "The directional sign has one oblique, low-resolution observation. Connectivity is known, but the sign text is not visually verified."
        },
        {
          id: "gap_west_far_end",
          kind: "single_view_coverage",
          severity: "warning",
          explanation: "The far end of the corridor was observed from one usable angle, reducing occlusion confidence."
        }
      ],
      recommendations: [
        {
          id: "recapture_west_sign_front",
          instruction: "Stand 2.5 metres in front of the directional sign and capture it near eye level with the text filling at least one third of the frame.",
          pose: { position: [65.5, 22, 1.6], target: [68, 22, 1.8] },
          expectedImprovement: { visual: 0.28, semantics: 0.21 }
        },
        {
          id: "recapture_west_reverse",
          instruction: "Capture the corridor from the Lift 2 side facing east to add reverse-angle coverage of the far end.",
          pose: { position: [79, 22, 1.6], target: [62, 22, 1.5] },
          expectedImprovement: { coverage: 0.19, visual: 0.11 }
        }
      ]
    },
    {
      regionId: "ticketing_zone",
      readiness: { generalExploration: 0.97, accessibleWayfinding: 0.98 },
      dimensions: { coverage: 0.97, visual: 0.95, geometry: 0.96, semantics: 0.98, freshness: 0.99 },
      gaps: [], recommendations: []
    }
  ],
  evidenceViews: [
    { id: "view_entrance_a", entityId: "entrance_a", visibility: 0.98, imageQuality: 0.96, pose: { position: [-9.288, 1.67, 2.58], target: [-7.56, 0.82, 0.18] } },
    { id: "view_ticket_machine_1", entityId: "ticket_machine_1", visibility: 0.95, imageQuality: 0.94, pose: { position: [-6.408, 1.67, 3.12], target: [-4.68, 0.82, 0.72] } },
    { id: "view_help_point_1", entityId: "help_point_1", visibility: 0.94, imageQuality: 0.92, pose: { position: [-5.508, 1.67, 1.86], target: [-3.78, 0.82, -0.54] } },
    { id: "view_accessible_gate_1", entityId: "accessible_gate_1", visibility: 0.98, imageQuality: 0.97, pose: { position: [-3.708, 1.67, 2.76], target: [-1.98, 0.82, 0.36] } },
    { id: "view_lift_1", entityId: "lift_1", visibility: 0.97, imageQuality: 0.94, pose: { position: [1.728, 1.67, 4], target: [3.96, 0.82, 0.9] } },
    { id: "view_lift_2", entityId: "lift_2", visibility: 0.86, imageQuality: 0.81, pose: { position: [3.528, 1.67, 2.02], target: [5.76, 0.82, -1.08] } },
    { id: "view_escalator_1", entityId: "escalator_1", visibility: 0.97, imageQuality: 0.95, pose: { position: [2.448, 1.67, 4], target: [4.68, 0.82, 0.9] } },
    { id: "view_bench_1", entityId: "bench_1", visibility: 0.97, imageQuality: 0.94, pose: { position: [-3.168, 4.67, 2.22], target: [-1.44, 4.22, -0.18] } },
    { id: "view_bench_2", entityId: "bench_2", visibility: 0.96, imageQuality: 0.94, pose: { position: [-0.468, 4.67, 2.22], target: [1.26, 4.22, -0.18] } },
    { id: "view_sign_west_oblique", entityId: "sign_west_platform", visibility: 0.58, imageQuality: 0.41, pose: { position: [1.512, 1.67, 1.5], target: [3.24, 0.82, -0.9] } },
    { id: "view_east_barrier", entityId: "barrier_east", visibility: 1, imageQuality: 1, pose: { position: [-0.648, 1.67, 3.3], target: [1.08, 0.82, 0.9] } }
  ]
};
