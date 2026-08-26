// @ts-check

/**
 * This file contains JSDoc typedefs so the package stays dependency-free while
 * retaining editor and TypeScript language-server support.
 */

/** @typedef {[number, number, number]} Vec3 */

/**
 * @typedef {Object} CameraPose
 * @property {Vec3} position
 * @property {Vec3} target
 */

/**
 * @typedef {Object} EntityConfidence
 * @property {number} category
 * @property {number} boundary
 * @property {number} geometry
 * @property {number} coverage
 * @property {number} freshness
 */

/**
 * @typedef {Object} SpatialEntity
 * @property {string} id
 * @property {string} type
 * @property {string} label
 * @property {string[]} aliases
 * @property {string} regionId
 * @property {Vec3} position
 * @property {string[]} tags
 * @property {string} description
 * @property {Record<string, string|number|boolean>} state
 * @property {EntityConfidence} confidence
 * @property {string[]} bestViewIds
 */

/**
 * @typedef {Object} SpatialRegion
 * @property {string} id
 * @property {string} type
 * @property {string} label
 * @property {string|null} parentId
 * @property {number} floor
 * @property {{x:number,y:number,width:number,height:number}} mapBounds
 */

/**
 * @typedef {Object} SpatialRelation
 * @property {string} subjectId
 * @property {string} predicate
 * @property {string} objectId
 * @property {number} confidence
 * @property {string[]} evidenceIds
 */

/**
 * @typedef {Object} NavigationNode
 * @property {string} id
 * @property {string} label
 * @property {string} regionId
 * @property {{x:number,y:number,floor:number}} point
 * @property {string[]} entityIds
 */

/**
 * @typedef {Object} NavigationEdge
 * @property {string} from
 * @property {string} to
 * @property {number} distance
 * @property {boolean} accessible
 * @property {"walk"|"lift"|"stairs"|"escalator"} mode
 * @property {string} regionId
 * @property {string=} requiresOperationalEntityId
 * @property {string=} blockedByEntityId
 * @property {boolean=} bidirectional
 */

/**
 * @typedef {Object} SceneContext
 * @property {CameraPose|null} cameraPose
 * @property {string|null} currentRegionId
 * @property {string|null} selectedEntityId
 * @property {string[]} visibleEntityIds
 */

/**
 * @typedef {Object} SpatialViewerAdapter
 * @property {() => Promise<SceneContext>} getContext
 * @property {(entity: SpatialEntity, options?:Record<string,unknown>) => Promise<void>} navigateToEntity
 * @property {(entityIds:string[]) => Promise<void>} highlightEntities
 * @property {(route:Record<string,unknown>|null) => Promise<void>} setRoute
 * @property {(quality:Record<string,unknown>|null) => Promise<void>} showQualityOverlay
 * @property {(changes:Record<string,unknown>[]) => Promise<void>} onScenarioChanged
 */

export {};
