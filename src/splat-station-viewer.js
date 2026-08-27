// @ts-check

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import {
  navigationPointToWorld,
  regionAtSemanticPosition,
  regionToWorldFootprint,
  resolveEntityView,
  semanticCapturePointToWorld,
  semanticPositionToWorld,
  worldPositionToSemantic
} from "./spatial-coordinates.js";
import { throwIfAborted } from "./schema-validator.js";

const ENTITY_COLORS = Object.freeze({
  entrance: 0x9fffd6,
  ticket_machine: 0x8ec5ff,
  help_point: 0xffd990,
  fare_gate: 0x95f1ff,
  lift: 0x80ffd4,
  escalator: 0xd5c6ff,
  bench: 0xc4d4cf,
  directional_sign: 0xffc77a,
  temporary_barrier: 0xff9f86
});

const REGION_COLORS = Object.freeze({
  entrance_a_zone: 0x315f50,
  ticketing_zone: 0x31535c,
  east_corridor: 0x2e594d,
  west_corridor: 0x4c5140,
  vertical_core_east: 0x385c57,
  vertical_core_west: 0x4c5448,
  platform_2_zone: 0x2d4a56,
  platform_east_lobby: 0x31505a,
  platform_west_lobby: 0x3f4e50
});

/** @param {number} seed */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** @param {string} value */
function hashString(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** @param {string} type */
function entityDimensions(type) {
  const dimensions = {
    entrance: [1.4, 2.2, 0.35],
    ticket_machine: [0.55, 1.3, 0.4],
    help_point: [1.5, 0.95, 0.6],
    fare_gate: [1.1, 0.9, 0.38],
    lift: [1.25, 2.35, 1.1],
    escalator: [1.5, 0.8, 2.5],
    bench: [1.55, 0.55, 0.58],
    directional_sign: [1.2, 0.7, 0.18],
    temporary_barrier: [1.45, 0.9, 0.25]
  }[type];
  return dimensions ?? [0.7, 0.7, 0.7];
}

/** @param {number} value */
function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}

/**
 * Spark-backed viewer for the station fixture. Semantic IDs stay attached to
 * lightweight proxy meshes while Gaussian splats provide the scene appearance.
 */
export class SplatStationViewer {
  /**
   * @param {HTMLElement} container
   * @param {any} semanticScene
   * @param {{splatUrl?:string|null,appearanceTransform?:{position?:number[],rotation?:number[],scale?:number[]}}=} options
   */
  constructor(container, semanticScene, options = {}) {
    this.container = container;
    this.semanticScene = semanticScene;
    this.options = options;
    this.onEntitySelect = null;
    this.selectedEntityId = null;
    this.currentRegionId = "entrance_a_zone";
    this.highlightedEntityIds = new Set();
    this.entityObjects = new Map();
    this.entityLabels = new Map();
    this.routeGroup = null;
    this.qualityGroup = null;
    this.cameraTween = null;
    this.pointerStart = null;
    this.appearanceInfo = null;
  }

  async initialize() {
    if (!this.container) throw new Error("The splat viewer container is missing.");
    if (!globalThis.WebGL2RenderingContext) throw new Error("This browser does not expose WebGL 2.");

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111418);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 200);
    this.camera.position.set(-9.5, 7.2, 10.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.domElement.className = "splat-canvas";

    this.labelLayer = document.createElement("div");
    this.labelLayer.className = "spatial-label-layer";
    this.container.querySelector(".splat-canvas")?.remove();
    this.container.querySelector(".spatial-label-layer")?.remove();
    this.container.prepend(this.renderer.domElement, this.labelLayer);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 32;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.target.set(0, 1.2, 0);

    this.spark = new SparkRenderer({ renderer: this.renderer });
    this.scene.add(this.spark);

    this.appearanceInfo = await this.createAppearance();
    this.createEntityProxies();
    this.createOrientationGrid();
    this.installInteraction();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.renderer.setAnimationLoop((time) => this.animate(time));

    return this.appearanceInfo;
  }

  async createAppearance() {
    if (this.options.splatUrl) {
      try {
        const splat = new SplatMesh({ url: this.options.splatUrl, lod: true });
        await splat.initialized;
        this.applyAppearanceTransform(splat);
        this.scene.add(splat);
        this.appearance = splat;
        return {
          kind: "captured",
          source: this.options.splatUrl,
          splats: splat.splats?.getNumSplats?.() ?? splat.numSplats
        };
      } catch (error) {
        console.warn("The requested splat could not be loaded. Using the generated station fixture.", error);
      }
    }

    const station = new SplatMesh({
      maxSplats: 18000,
      constructSplats: (splats) => this.constructStationSplats(splats)
    });
    await station.initialized;
    this.scene.add(station);
    this.appearance = station;
    return {
      kind: "synthetic",
      source: "deterministic semantic station fixture",
      splats: station.splats?.getNumSplats?.() ?? station.numSplats
    };
  }

  /** @param {THREE.Object3D} object */
  applyAppearanceTransform(object) {
    const transform = this.options.appearanceTransform ?? {};
    if (transform.position?.length === 3) object.position.fromArray(transform.position);
    if (transform.rotation?.length === 3) object.rotation.fromArray([...transform.rotation, "XYZ"]);
    if (transform.scale?.length === 3) object.scale.fromArray(transform.scale);
  }

  /** @param {any} splats */
  constructStationSplats(splats) {
    const center = new THREE.Vector3();
    const scales = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const color = new THREE.Color();
    const random = seededRandom(20260826);

    const push = (position, size, hex, opacity = 1) => {
      center.set(position[0], position[1], position[2]);
      scales.set(size[0], size[1], size[2]);
      color.setHex(hex);
      color.offsetHSL((random() - 0.5) * 0.015, (random() - 0.5) * 0.08, (random() - 0.5) * 0.055);
      splats.pushSplat(center, scales, quaternion, opacity, color);
    };

    for (const region of this.semanticScene.regions.filter((item) => item.type === "zone")) {
      const bounds = region.mapBounds;
      const regionColor = REGION_COLORS[region.id] ?? 0x36534c;
      for (let mapX = bounds.x + 0.3; mapX < bounds.x + bounds.width; mapX += 0.72) {
        for (let mapY = bounds.y + 0.3; mapY < bounds.y + bounds.height; mapY += 0.72) {
          const world = semanticPositionToWorld([
            mapX + (random() - 0.5) * 0.18,
            mapY + (random() - 0.5) * 0.18,
            region.floor
          ]);
          push(world, [0.095, 0.026, 0.095], regionColor, 0.97);
        }
      }
    }

    for (const floor of [0, 1]) {
      const mapY = floor === 0 ? 3 : 38;
      const width = 96;
      const height = 28;
      const wallPoints = [];
      for (let mapX = 2; mapX <= 2 + width; mapX += 0.7) {
        wallPoints.push([mapX, mapY], [mapX, mapY + height]);
      }
      for (let edgeY = mapY; edgeY <= mapY + height; edgeY += 0.7) {
        wallPoints.push([2, edgeY], [2 + width, edgeY]);
      }
      for (const [wallX, wallY] of wallPoints) {
        const base = semanticPositionToWorld([wallX, wallY, floor]);
        for (let wallHeight = 0.25; wallHeight < 2.8; wallHeight += 0.34) {
          push([base[0], base[1] + wallHeight, base[2]], [0.075, 0.075, 0.035], 0x637d75, 0.87);
        }
      }

      for (const mapX of [20, 43, 66, 88]) {
        for (let heightIndex = 0; heightIndex < 18; heightIndex += 1) {
          const base = semanticPositionToWorld([mapX, mapY + 14, floor]);
          const angle = heightIndex * 2.399;
          const radius = 0.16 + random() * 0.04;
          push([
            base[0] + Math.cos(angle) * radius,
            base[1] + heightIndex * 0.15,
            base[2] + Math.sin(angle) * radius
          ], [0.085, 0.085, 0.085], 0x82948f, 0.94);
        }
      }
    }

    for (const entity of this.semanticScene.entities.filter((item) => item.type !== "temporary_barrier")) {
      const base = semanticPositionToWorld(entity.position);
      const dimensions = entityDimensions(entity.type);
      const entityRandom = seededRandom(hashString(entity.id));
      const count = entity.type === "lift" || entity.type === "escalator" ? 150 : 80;
      const entityColor = ENTITY_COLORS[entity.type] ?? 0xb7c7c2;
      for (let index = 0; index < count; index += 1) {
        const face = index % 6;
        const local = [
          (entityRandom() - 0.5) * dimensions[0],
          entityRandom() * dimensions[1],
          (entityRandom() - 0.5) * dimensions[2]
        ];
        if (face === 0) local[0] = -dimensions[0] / 2;
        if (face === 1) local[0] = dimensions[0] / 2;
        if (face === 2) local[1] = 0;
        if (face === 3) local[1] = dimensions[1];
        if (face === 4) local[2] = -dimensions[2] / 2;
        if (face === 5) local[2] = dimensions[2] / 2;
        push([
          base[0] + local[0],
          base[1] + local[1],
          base[2] + local[2]
        ], [0.075, 0.075, 0.075], entityColor, 0.96);
      }
    }
  }

  createOrientationGrid() {
    const grid = new THREE.GridHelper(20, 40, 0x42665c, 0x1b312b);
    grid.position.y = 0.02;
    this.scene.add(grid);
  }

  createEntityProxies() {
    for (const entity of this.semanticScene.entities) {
      const dimensions = entityDimensions(entity.type);
      const geometry = new THREE.BoxGeometry(...dimensions);
      const material = new THREE.MeshBasicMaterial({
        color: ENTITY_COLORS[entity.type] ?? 0xb7c7c2,
        transparent: true,
        opacity: entity.type === "temporary_barrier" ? 0.08 : 0.11,
        depthWrite: false,
        depthTest: false,
        wireframe: true
      });
      const mesh = new THREE.Mesh(geometry, material);
      const world = semanticPositionToWorld(entity.position);
      mesh.position.set(world[0], world[1] + dimensions[1] / 2, world[2]);
      mesh.renderOrder = 10;
      mesh.userData = {
        entityId: entity.id,
        baseColor: material.color.getHex(),
        height: dimensions[1],
        type: entity.type
      };
      this.scene.add(mesh);
      this.entityObjects.set(entity.id, mesh);

      const label = document.createElement("span");
      label.className = "entity-label";
      label.textContent = entity.label;
      label.dataset.entityId = entity.id;
      if (["entrance", "lift", "fare_gate"].includes(entity.type)) label.classList.add("pinned");
      this.labelLayer.append(label);
      this.entityLabels.set(entity.id, label);
      this.syncEntityState(entity);
    }
  }

  installInteraction() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.renderer.domElement.addEventListener("pointerdown", (event) => {
      this.pointerStart = [event.clientX, event.clientY];
    });
    this.renderer.domElement.addEventListener("pointerup", (event) => {
      if (!this.pointerStart) return;
      const movement = Math.hypot(event.clientX - this.pointerStart[0], event.clientY - this.pointerStart[1]);
      this.pointerStart = null;
      if (movement > 5) return;

      const bounds = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects([...this.entityObjects.values()], false);
      const entityId = hits[0]?.object.userData.entityId;
      if (entityId && typeof this.onEntitySelect === "function") this.onEntitySelect(entityId);
    });
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /** @param {number} time */
  animate(time) {
    this.updateCameraTween(time);
    this.controls.update();
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
  }

  /** @param {number} time */
  updateCameraTween(time) {
    if (!this.cameraTween) return;
    const progress = Math.min(1, (time - this.cameraTween.startedAt) / this.cameraTween.duration);
    const eased = easeInOutCubic(progress);
    this.camera.position.lerpVectors(this.cameraTween.fromPosition, this.cameraTween.toPosition, eased);
    this.controls.target.lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, eased);
    if (progress === 1) {
      this.finishCameraTween("resolve");
    }
  }

  /** @param {"resolve"|"reject"} outcome @param {unknown=} reason */
  finishCameraTween(outcome, reason) {
    const tween = this.cameraTween;
    if (!tween) return;
    this.cameraTween = null;
    if (tween.signal && tween.onAbort) tween.signal.removeEventListener("abort", tween.onAbort);
    if (outcome === "reject") tween.reject(reason);
    else tween.resolve();
  }

  updateLabels() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    for (const [entityId, label] of this.entityLabels) {
      const mesh = this.entityObjects.get(entityId);
      if (!mesh) continue;
      if (!mesh.visible) {
        label.hidden = true;
        continue;
      }
      const projected = mesh.position.clone();
      projected.y += mesh.userData.height / 2 + 0.18;
      projected.project(this.camera);
      const visible = projected.z > -1 && projected.z < 1;
      label.hidden = !visible;
      if (!visible) continue;
      label.style.transform = `translate(-50%, -50%) translate(${(projected.x * 0.5 + 0.5) * width}px, ${(-projected.y * 0.5 + 0.5) * height}px)`;
    }
  }

  async getContext() {
    this.camera.updateMatrixWorld();
    const projection = new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(projection);
    const visibleEntityIds = [];
    const position = new THREE.Vector3();
    for (const [entityId, mesh] of this.entityObjects) {
      if (!mesh.visible) continue;
      mesh.getWorldPosition(position);
      if (frustum.containsPoint(position)) visibleEntityIds.push(entityId);
    }
    const cameraPosition = worldPositionToSemantic(this.camera.position.toArray());
    const region = regionAtSemanticPosition(this.semanticScene.regions, cameraPosition);
    this.currentRegionId = region?.id ?? null;
    return {
      cameraPose: {
        position: this.camera.position.toArray().map((value) => Number(value.toFixed(3))),
        target: this.controls.target.toArray().map((value) => Number(value.toFixed(3)))
      },
      currentRegionId: this.currentRegionId,
      selectedEntityId: this.selectedEntityId,
      visibleEntityIds
    };
  }

  /** @param {any} entity @param {{animate?:boolean,signal?:AbortSignal}=} options */
  async navigateToEntity(entity, options = {}) {
    throwIfAborted(options.signal);
    this.selectedEntityId = entity.id;
    this.currentRegionId = entity.regionId;
    this.updateEntityPresentation();
    const view = resolveEntityView(entity, this.semanticScene.evidenceViews);
    const pose = view.pose;
    const target = new THREE.Vector3().fromArray(pose.target);
    const position = new THREE.Vector3().fromArray(pose.position);

    if (options.animate === false) {
      this.finishCameraTween("resolve");
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      return { selectedViewId: view.selectedViewId };
    }

    this.finishCameraTween("resolve");
    await new Promise((resolve, reject) => {
      const onAbort = () => this.finishCameraTween(
        "reject",
        options.signal?.reason ?? new DOMException("Camera navigation was aborted.", "AbortError")
      );
      this.cameraTween = {
        fromPosition: this.camera.position.clone(),
        fromTarget: this.controls.target.clone(),
        toPosition: position,
        toTarget: target,
        startedAt: performance.now(),
        duration: 720,
        resolve,
        reject,
        signal: options.signal,
        onAbort
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
    });
    return { selectedViewId: view.selectedViewId };
  }

  /** @param {string[]} entityIds */
  async highlightEntities(entityIds) {
    this.highlightedEntityIds = new Set(entityIds);
    this.updateEntityPresentation();
  }

  updateEntityPresentation() {
    for (const [entityId, mesh] of this.entityObjects) {
      const selected = entityId === this.selectedEntityId;
      const highlighted = this.highlightedEntityIds.has(entityId);
      const inactiveBarrier = mesh.userData.type === "temporary_barrier" && mesh.userData.active !== true;
      if (mesh.userData.type === "temporary_barrier") mesh.visible = !inactiveBarrier || selected;
      mesh.material.opacity = inactiveBarrier ? 0.06 : selected ? 0.78 : highlighted ? 0.38 : 0.11;
      mesh.material.wireframe = true;
      mesh.material.color.setHex(selected ? 0xffffff : mesh.userData.stateColor ?? mesh.userData.baseColor);
      const label = this.entityLabels.get(entityId);
      label?.classList.toggle("active", selected || highlighted);
    }
  }

  /** @param {any} route */
  async setRoute(route) {
    if (this.routeGroup) {
      this.scene.remove(this.routeGroup);
      this.disposeGroup(this.routeGroup);
      this.routeGroup = null;
    }
    if (!route?.found || route.nodes.length < 2) return;

    const points = route.nodes.map((node) => {
      const point = navigationPointToWorld(node.point);
      return new THREE.Vector3(point[0], point[1] + 0.18, point[2]);
    });
    const group = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(24, points.length * 10), 0.065, 8, false),
      new THREE.MeshBasicMaterial({ color: 0xe9fff7, transparent: true, opacity: 0.96, depthTest: false })
    );
    tube.renderOrder = 20;
    group.add(tube);

    for (const point of points) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0x8fffcf, depthTest: false })
      );
      marker.position.copy(point);
      marker.renderOrder = 21;
      group.add(marker);
    }
    this.routeGroup = group;
    this.scene.add(group);
  }

  /** @param {any} quality */
  async showQualityOverlay(quality) {
    if (this.qualityGroup) {
      this.scene.remove(this.qualityGroup);
      this.disposeGroup(this.qualityGroup);
      this.qualityGroup = null;
    }
    if (!quality) return;

    const region = this.semanticScene.regions.find((item) => item.id === quality.regionId);
    if (!region) return;
    const footprint = regionToWorldFootprint(region);
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: 0xffc76f,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(footprint.width, footprint.depth), material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(footprint.center[0], footprint.center[1] + 0.1, footprint.center[2]);
    plane.renderOrder = 15;
    group.add(plane);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(footprint.width, 2.6, footprint.depth)),
      new THREE.LineBasicMaterial({ color: 0xffd18b, transparent: true, opacity: 0.78, depthTest: false })
    );
    edges.position.set(footprint.center[0], footprint.center[1] + 1.3, footprint.center[2]);
    edges.renderOrder = 16;
    group.add(edges);

    for (const recommendation of quality.recommendations ?? []) {
      const position = new THREE.Vector3().fromArray(semanticCapturePointToWorld(recommendation.pose.position, region.floor));
      const target = new THREE.Vector3().fromArray(semanticCapturePointToWorld(recommendation.pose.target, region.floor));
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 14, 10),
        new THREE.MeshBasicMaterial({ color: 0xffd18b, depthTest: false })
      );
      marker.position.copy(position);
      marker.renderOrder = 18;
      group.add(marker);

      const sightline = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([position, target]),
        new THREE.LineDashedMaterial({ color: 0xffd18b, dashSize: 0.16, gapSize: 0.1, depthTest: false })
      );
      sightline.computeLineDistances();
      sightline.renderOrder = 17;
      group.add(sightline);
    }
    this.qualityGroup = group;
    this.scene.add(group);
  }

  /** @param {any} entity */
  async syncEntityState(entity) {
    const mesh = this.entityObjects.get(entity.id);
    if (!mesh) return;
    const inactive = entity.state.operational === "closed" || entity.state.operational === "unavailable";
    const blocking = entity.state.active === true || entity.state.blocking === true;
    mesh.userData.active = blocking;
    mesh.userData.stateColor = inactive ? 0xff746d : blocking ? 0xffb568 : null;
    mesh.visible = entity.type !== "temporary_barrier" || blocking || entity.id === this.selectedEntityId;
    this.updateEntityPresentation();
  }

  /** @param {THREE.Object3D} group */
  disposeGroup(group) {
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose?.();
    });
  }
}
