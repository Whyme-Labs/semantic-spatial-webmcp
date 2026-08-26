// @ts-check

import { demoScene } from "./demo-scene.js";
import { SpatialSceneStore } from "./scene-store.js";
import { SpatialToolRuntime } from "./tool-runtime.js";
import { BrowserSpatialViewerAdapter } from "./viewer-adapter.js";
import { registerWebMCPTools } from "./webmcp-adapter.js";

const store = new SpatialSceneStore(demoScene);
const viewer = new BrowserSpatialViewerAdapter({ store });
const runtime = new SpatialToolRuntime(store, viewer);
window.spatialDemo = { store, viewer, runtime, webmcp: null };

const elements = {
  map: document.querySelector("#station-map"),
  sceneShell: document.querySelector("#scene-shell"),
  splatViewport: document.querySelector("#splat-viewport"),
  sceneMode: document.querySelector("#scene-mode-label"),
  viewMode: document.querySelector("#view-mode-button"),
  entityLayer: document.querySelector("#entity-layer"),
  routeLayer: document.querySelector("#route-layer"),
  qualityLayer: document.querySelector("#quality-layer"),
  details: document.querySelector("#details"),
  log: document.querySelector("#tool-log"),
  status: document.querySelector("#webmcp-status"),
  search: document.querySelector("#search-input"),
  searchResults: document.querySelector("#search-results"),
  toolSelect: document.querySelector("#tool-select"),
  toolArgs: document.querySelector("#tool-args"),
  toolOutput: document.querySelector("#tool-output"),
  missionButton: document.querySelector("#mission-button"),
  missionStatus: document.querySelector("#mission-status"),
  missionPrompt: document.querySelector("#mission-prompt"),
  copyPromptButton: document.querySelector("#copy-prompt-button")
};

const missionStepOrder = ["baseline", "outage", "alternate", "evidence", "restore"];
let missionRunning = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[character]));
}

function renderTimelineEvent(event) {
  const selector = `[data-invocation-id="${CSS.escape(event.invocationId)}"]`;
  if (event.phase === "start") {
    const item = document.createElement("li");
    item.dataset.invocationId = event.invocationId;
    item.innerHTML = `<strong>${escapeHtml(event.source)} · ${escapeHtml(event.tool)}</strong><code>${escapeHtml(JSON.stringify(event.args))}</code><span>Running…</span>`;
    elements.log.prepend(item);
    return;
  }

  const item = elements.log.querySelector(selector);
  if (!item) return;
  item.dataset.status = event.status;
  const summary = event.status === "error"
    ? `Error: ${event.error}`
    : event.status === "cancelled" ? "Cancelled" : summarize(event.result);
  item.querySelector("span").textContent = summary;
  if (event.status === "success") updateMissionProgress(event);
}

function missionNode(step) {
  return document.querySelector(`[data-mission-step="${step}"]`);
}

function markMissionStep(step, state) {
  const node = missionNode(step);
  if (!node) return;
  node.dataset.state = state;
}

function resetMissionProgress() {
  for (const step of missionStepOrder) {
    const node = missionNode(step);
    if (node) delete node.dataset.state;
  }
}

function updateMissionProgress(event) {
  const result = event.result;
  if (event.tool === "find_semantic_route" && result?.found && result.entityIds?.includes("lift_1")) {
    markMissionStep("baseline", "complete");
  }
  if (event.tool === "set_entity_state" && result?.change?.entityId === "lift_1" && result.change.after?.operational === "closed") {
    markMissionStep("outage", "complete");
  }
  if (event.tool === "find_semantic_route" && result?.found && result.entityIds?.includes("lift_2")) {
    markMissionStep("alternate", "complete");
  }
  if (event.tool === "get_region_quality" && result?.region?.id === "west_corridor") {
    markMissionStep("evidence", "complete");
  }
  if ((event.tool === "undo_scene_change" && result?.undone) || event.tool === "reset_scene") {
    markMissionStep("restore", "complete");
  }
  if (missionStepOrder.every((step) => missionNode(step)?.dataset.state === "complete")) {
    elements.missionStatus.textContent = "Workflow complete: alternate route explained, outage undone, baseline restored.";
  }
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function runGuidedProof() {
  if (missionRunning) return;
  missionRunning = true;
  elements.missionButton.disabled = true;
  elements.missionButton.textContent = "Running proof…";
  elements.missionStatus.textContent = "Resetting the station and establishing the baseline route…";
  resetMissionProgress();

  try {
    await invoke("reset_scene", {});
    markMissionStep("restore", "pending");
    markMissionStep("baseline", "active");
    await invoke("find_semantic_route", { from: "Entrance A", to: "Platform 2", accessibleOnly: true });
    await delay(300);
    markMissionStep("outage", "active");
    elements.missionStatus.textContent = "Staging Lift 1 as closed…";
    await invoke("set_entity_state", { entityId: "lift_1", patch: { operational: "closed" } });
    await delay(300);
    markMissionStep("alternate", "active");
    elements.missionStatus.textContent = "Recalculating through Lift 2…";
    await invoke("find_semantic_route", { from: "Entrance A", to: "Platform 2", accessibleOnly: true });
    await delay(300);
    markMissionStep("evidence", "active");
    elements.missionStatus.textContent = "Opening the weak West corridor evidence…";
    await invoke("get_region_quality", { regionId: "west_corridor" });
    await delay(500);
    markMissionStep("restore", "active");
    elements.missionStatus.textContent = "Undoing the outage and restoring the baseline…";
    await invoke("undo_scene_change", {});
    elements.missionStatus.textContent = "Proof complete: alternate route explained, outage undone, baseline restored.";
  } catch (error) {
    elements.missionStatus.textContent = `Proof stopped: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    missionRunning = false;
    elements.missionButton.disabled = false;
    elements.missionButton.textContent = "Run guided proof";
  }
}

function summarize(value) {
  if (!value) return "No result";
  if (value.summary) return value.summary;
  if (value.found === false) return value.reason ?? "Not found";
  if (value.count !== undefined) return `${value.count} result${value.count === 1 ? "" : "s"}`;
  if (value.staged) return `Staged ${value.change.entityId}`;
  if (value.undone) return `Undid ${value.change.entityId}`;
  return JSON.stringify(value).slice(0, 180);
}

async function invoke(name, args = {}) {
  return runtime.invoke(name, args, { source: "human" });
}

runtime.observe(renderTimelineEvent);

function renderRegions() {
  const svg = elements.map;
  for (const region of demoScene.regions.filter((item) => item.type === "zone")) {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const b = region.mapBounds;
    rect.setAttribute("x", String(b.x));
    rect.setAttribute("y", String(b.y));
    rect.setAttribute("width", String(b.width));
    rect.setAttribute("height", String(b.height));
    rect.setAttribute("rx", "1.5");
    rect.classList.add("region");
    rect.dataset.regionId = region.id;
    svg.insertBefore(rect, elements.qualityLayer);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(b.x + 1.5));
    label.setAttribute("y", String(b.y + 3));
    label.classList.add("region-label");
    label.textContent = region.label;
    svg.insertBefore(label, elements.qualityLayer);
  }
}

function entityShape(entity) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.classList.add("entity");
  group.dataset.entityId = entity.id;
  group.setAttribute("tabindex", "0");
  group.setAttribute("role", "button");
  group.setAttribute("aria-label", entity.label);

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", String(entity.position[0]));
  circle.setAttribute("cy", String(entity.position[1]));
  circle.setAttribute("r", entity.type === "lift" ? "2.2" : "1.5");
  group.append(circle);

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", String(entity.position[0] + 2));
  text.setAttribute("y", String(entity.position[1] - 1));
  text.textContent = entity.label;
  group.append(text);

  const activate = () => invoke("navigate_to_entity", { entityId: entity.id });
  group.addEventListener("click", activate);
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") activate();
  });
  return group;
}

function renderEntities() {
  elements.entityLayer.replaceChildren();
  for (const entity of demoScene.entities) elements.entityLayer.append(entityShape(entity));
  updateEntityStateClasses();
}

function updateEntityStateClasses() {
  for (const node of elements.entityLayer.querySelectorAll(".entity")) {
    const entity = store.getEntity(node.dataset.entityId);
    node.classList.toggle("inactive", entity?.state.operational === "closed" || entity?.state.operational === "unavailable");
    node.classList.toggle("blocking", entity?.state.active === true || entity?.state.blocking === true);
  }
}

function showEntityDetails(entity) {
  const region = store.getRegion(entity.regionId);
  const minimumConfidence = Math.min(...Object.values(entity.confidence));
  elements.details.innerHTML = `
    <h3>${escapeHtml(entity.label)}</h3>
    <p>${escapeHtml(entity.description)}</p>
    <dl>
      <dt>Type</dt><dd>${escapeHtml(entity.type)}</dd>
      <dt>Region</dt><dd>${escapeHtml(region?.label ?? entity.regionId)}</dd>
      <dt>State</dt><dd><code>${escapeHtml(JSON.stringify(entity.state))}</code></dd>
      <dt>Weakest confidence</dt><dd>${Math.round(minimumConfidence * 100)}%</dd>
    </dl>
  `;
}

function renderRoute(route) {
  elements.routeLayer.replaceChildren();
  if (!route?.found) return;
  const points = route.nodes.map((node) => `${node.point.x},${node.point.y}`).join(" ");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", points);
  line.classList.add("route-line");
  elements.routeLayer.append(line);

  if (route.warnings.length) {
    elements.details.innerHTML = `
      <h3>Route ready, evidence warning</h3>
      <p>${escapeHtml(route.summary)}</p>
      ${route.warnings.map((warning) => `
        <section class="warning-card">
          <strong>${escapeHtml(warning.label)}: ${Math.round(warning.readiness * 100)}% wayfinding readiness</strong>
          ${warning.gaps.map((gap) => `<p>${escapeHtml(gap.explanation)}</p>`).join("")}
        </section>
      `).join("")}
    `;
  } else {
    elements.details.innerHTML = `<h3>Accessible route</h3><p>${escapeHtml(route.summary)}</p><p>${route.distanceMeters} metres.</p>`;
  }
}

function renderQuality(quality) {
  elements.qualityLayer.replaceChildren();
  document.querySelectorAll(".region").forEach((node) => node.classList.remove("quality-weak"));
  if (!quality) return;
  const regionNode = document.querySelector(`[data-region-id="${CSS.escape(quality.regionId)}"]`);
  regionNode?.classList.add("quality-weak");
  const region = store.getRegion(quality.regionId);
  elements.details.innerHTML = `
    <h3>${escapeHtml(region?.label ?? quality.regionId)} capture quality</h3>
    <p>Accessible-wayfinding readiness: <strong>${Math.round(quality.readiness.accessibleWayfinding * 100)}%</strong></p>
    ${quality.gaps.map((gap) => `<section class="warning-card"><strong>${escapeHtml(gap.kind)}</strong><p>${escapeHtml(gap.explanation)}</p></section>`).join("")}
    <h4>Best available evidence</h4>
    ${(quality.evidenceViews ?? []).map((view) => `<p><code>${escapeHtml(view.id)}</code> · ${Math.round(view.visibility * 100)}% visible · ${Math.round(view.imageQuality * 100)}% image quality</p>`).join("") || "<p>No entity-specific evidence view.</p>"}
    <h4>Recommended recaptures</h4>
    ${quality.recommendations.map((item) => `<p>${escapeHtml(item.instruction)}</p>`).join("") || "<p>No recapture required.</p>"}
  `;
}

window.addEventListener("spatial:navigate", (event) => {
  const entity = event.detail.entity;
  document.querySelectorAll(".entity").forEach((node) => node.classList.toggle("selected", node.dataset.entityId === entity.id));
  showEntityDetails(entity);
});

window.addEventListener("spatial:highlight", (event) => {
  const selected = new Set(event.detail.entityIds);
  document.querySelectorAll(".entity").forEach((node) => node.classList.toggle("highlighted", selected.has(node.dataset.entityId)));
});

window.addEventListener("spatial:route", (event) => renderRoute(event.detail.route));
window.addEventListener("spatial:quality", (event) => renderQuality(event.detail.quality));
window.addEventListener("spatial:scenario", () => updateEntityStateClasses());

async function runSearch() {
  const query = elements.search.value.trim();
  const result = await invoke("search_entities", { query, limit: 10 });
  elements.searchResults.innerHTML = result.results.map((entity) => `
    <button type="button" data-entity-id="${escapeHtml(entity.id)}">
      <span>${escapeHtml(entity.label)}</span><small>${escapeHtml(entity.type)}</small>
    </button>
  `).join("") || "<p>No entity found.</p>";
  elements.searchResults.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => invoke("navigate_to_entity", { entityId: button.dataset.entityId }));
  });
}

document.querySelector("#search-button").addEventListener("click", runSearch);
elements.search.addEventListener("keydown", (event) => { if (event.key === "Enter") runSearch(); });

document.querySelector("#route-button").addEventListener("click", () => invoke("find_semantic_route", {
  from: "Entrance A", to: "Platform 2", accessibleOnly: true
}));

document.querySelector("#close-lift-button").addEventListener("click", () => invoke("set_entity_state", {
  entityId: "lift_1", patch: { operational: "closed" }
}));

document.querySelector("#barrier-button").addEventListener("click", async () => {
  const entity = store.getEntity("barrier_east");
  await invoke("set_entity_state", { entityId: "barrier_east", patch: { active: !entity.state.active } });
});

document.querySelector("#quality-button").addEventListener("click", () => invoke("get_region_quality", { regionId: "west_corridor" }));
document.querySelector("#uncertain-button").addEventListener("click", () => invoke("list_uncertain_entities", { threshold: 0.8 }));
document.querySelector("#undo-button").addEventListener("click", () => invoke("undo_scene_change", {}));
document.querySelector("#reset-button").addEventListener("click", async () => {
  await invoke("reset_scene", {});
  elements.details.innerHTML = "<h3>Scene reset</h3><p>The station returned to its baseline state.</p>";
});

elements.missionButton.addEventListener("click", runGuidedProof);
elements.copyPromptButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.missionPrompt.textContent.trim());
    elements.copyPromptButton.textContent = "Copied";
    setTimeout(() => { elements.copyPromptButton.textContent = "Copy agent prompt"; }, 1400);
  } catch {
    elements.missionStatus.textContent = "Copy was unavailable. Select the prompt above and copy it manually.";
  }
});

elements.viewMode.addEventListener("click", () => {
  const showingMap = elements.sceneShell.dataset.mode === "map";
  elements.sceneShell.dataset.mode = showingMap ? "splat" : "map";
  elements.viewMode.textContent = showingMap ? "Show 2D map" : "Show 3D splats";
  elements.viewMode.setAttribute("aria-pressed", String(!showingMap));
});

for (const tool of runtime.listTools()) {
  const option = document.createElement("option");
  option.value = tool.name;
  option.textContent = tool.name;
  elements.toolSelect.append(option);
}

elements.toolSelect.addEventListener("change", () => {
  const examples = {
    get_scene_context: {},
    search_entities: { query: "accessible gate" },
    get_entity: { entityId: "lift_1" },
    navigate_to_entity: { entityId: "help_point_1" },
    find_semantic_route: { from: "Entrance A", to: "Platform 2", accessibleOnly: true },
    set_entity_state: { entityId: "lift_1", patch: { operational: "closed" } },
    undo_scene_change: {},
    get_region_quality: { regionId: "west_corridor" },
    list_uncertain_entities: { threshold: 0.8 },
    reset_scene: {}
  };
  elements.toolArgs.value = JSON.stringify(examples[elements.toolSelect.value] ?? {}, null, 2);
});

document.querySelector("#invoke-tool-button").addEventListener("click", async () => {
  try {
    const args = JSON.parse(elements.toolArgs.value || "{}");
    const result = await invoke(elements.toolSelect.value, args);
    elements.toolOutput.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    elements.toolOutput.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
  }
});

renderRegions();
renderEntities();
elements.status.textContent = "Local runtime active. Preparing the shared viewer before WebMCP registration…";
elements.toolSelect.dispatchEvent(new Event("change"));
window.spatialDemo.runGuidedProof = runGuidedProof;

async function initializeSplatViewer() {
  try {
    const { SplatStationViewer } = await import("./splat-station-viewer.js");
    const splatUrl = new URLSearchParams(globalThis.location.search).get("splat");
    const splatViewer = new SplatStationViewer(elements.splatViewport, demoScene, { splatUrl });
    splatViewer.onEntitySelect = (entityId) => invoke("navigate_to_entity", { entityId });
    const appearance = await splatViewer.initialize();
    viewer.attachBridge(splatViewer);
    await viewer.onScenarioChanged([]);
    window.spatialDemo.splatViewer = splatViewer;

    const count = Number(appearance.splats ?? 0).toLocaleString();
    elements.sceneMode.textContent = appearance.kind === "captured"
      ? Number(appearance.splats) > 0
        ? `Captured Gaussian scene · ${count} splats`
        : "Captured Gaussian scene loaded"
      : `Synthetic Gaussian fixture · ${count} splats`;
  } catch (error) {
    console.error("The Gaussian-splat viewer did not start.", error);
    elements.sceneShell.dataset.mode = "map";
    elements.sceneMode.textContent = "3D unavailable · deterministic 2D fallback active";
    elements.viewMode.textContent = "3D unavailable";
    elements.viewMode.disabled = true;
  }
}

function renderWebMCPStatus(status) {
  if (status.state === "registering") {
    elements.status.textContent = `Shared viewer ready. Registering ${status.count} WebMCP tools…`;
  } else if (status.state === "active") {
    elements.status.textContent = `WebMCP active: ${status.count} tools registered`;
  } else if (status.state === "unsupported") {
    elements.status.textContent = `Local runtime active: ${runtime.listTools().length} tools. WebMCP registers automatically in a compatible browser.`;
  } else if (status.state === "error") {
    elements.status.textContent = `Local runtime active. WebMCP registration failed: ${status.error}`;
  }
}

const viewerReadiness = initializeSplatViewer();
window.spatialDemo.readiness = viewerReadiness;
try {
  window.spatialDemo.webmcp = await registerWebMCPTools(runtime, {
    readiness: viewerReadiness,
    onStatus: renderWebMCPStatus
  });
} catch (error) {
  console.error("WebMCP registration failed; the human interface remains active.", error);
}
