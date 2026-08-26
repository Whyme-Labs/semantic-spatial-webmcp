// @ts-check

import { demoScene } from "./demo-scene.js";
import { SpatialSceneStore } from "./scene-store.js";
import { SpatialToolRuntime } from "./tool-runtime.js";
import { DemoViewerAdapter } from "./viewer-adapter.js";
import { registerWebMCPTools } from "./webmcp-adapter.js";

const store = new SpatialSceneStore(demoScene);
const viewer = new DemoViewerAdapter();
const runtime = new SpatialToolRuntime(store, viewer);
const webmcp = registerWebMCPTools(runtime);

window.spatialDemo = { store, viewer, runtime, webmcp };

const elements = {
  map: document.querySelector("#station-map"),
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
  toolOutput: document.querySelector("#tool-output")
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  }[character]));
}

function logTool(name, args, result) {
  const item = document.createElement("li");
  item.innerHTML = `<strong>${escapeHtml(name)}</strong><code>${escapeHtml(JSON.stringify(args))}</code><span>${escapeHtml(summarize(result))}</span>`;
  elements.log.prepend(item);
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
  const result = await runtime.invoke(name, args);
  logTool(name, args, result);
  return result;
}

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
  from: "n_entrance", to: "n_platform", accessibleOnly: true
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
  store.resetScenario();
  await viewer.onScenarioChanged([]);
  await viewer.setRoute(null);
  await viewer.showQualityOverlay(null);
  elements.details.innerHTML = "<h3>Scene reset</h3><p>The station returned to its baseline state.</p>";
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
    find_semantic_route: { from: "n_entrance", to: "n_platform", accessibleOnly: true },
    set_entity_state: { entityId: "lift_1", patch: { operational: "closed" } },
    undo_scene_change: {},
    get_region_quality: { regionId: "west_corridor" },
    recommend_recapture: { regionId: "west_corridor" },
    list_uncertain_entities: { threshold: 0.8 }
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
elements.status.textContent = webmcp.registered
  ? `WebMCP active: ${webmcp.count} tools registered`
  : `Local runtime active: ${runtime.tools.length} tools. WebMCP registers automatically in a compatible browser.`;
elements.toolSelect.dispatchEvent(new Event("change"));
