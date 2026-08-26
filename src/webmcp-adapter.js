// @ts-check

import { assertPlainJson } from "./schema-validator.js";

const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;
const STANDARD_ANNOTATIONS = new Set(["readOnlyHint", "untrustedContentHint"]);

/** @param {any} schema @param {string} path */
function preflightSchema(schema, path) {
  assertPlainJson(schema, path);
  JSON.stringify(schema);
  if (schema.description && schema.description.length > 150) {
    throw new RangeError(`${path}.description exceeds 150 characters.`);
  }
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    if (name.length > 30) throw new RangeError(`${path} parameter name exceeds 30 characters: ${name}.`);
    preflightSchema(child, `${path}.properties.${name}`);
  }
  if (schema.items) preflightSchema(schema.items, `${path}.items`);
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    preflightSchema(schema.additionalProperties, `${path}.additionalProperties`);
  }
}

/** @param {any[]} tools */
function preflightCatalog(tools) {
  if (!Array.isArray(tools) || tools.length === 0) throw new TypeError("The WebMCP catalog must contain tools.");
  const names = new Set();
  for (const tool of tools) {
    if (!TOOL_NAME_PATTERN.test(tool.name ?? "")) throw new TypeError(`Invalid WebMCP tool name: ${tool.name ?? ""}.`);
    if (names.has(tool.name)) throw new TypeError(`Duplicate WebMCP tool name: ${tool.name}.`);
    names.add(tool.name);
    if (typeof tool.description !== "string" || !tool.description.trim()) {
      throw new TypeError(`${tool.name} must have a non-empty description.`);
    }
    if (tool.description.length > 500) throw new RangeError(`${tool.name} description exceeds 500 characters.`);
    preflightSchema(tool.inputSchema, `${tool.name}.inputSchema`);
    for (const [key, value] of Object.entries(tool.annotations ?? {})) {
      if (!STANDARD_ANNOTATIONS.has(key)) throw new TypeError(`${tool.name} uses unsupported annotation: ${key}.`);
      if (typeof value !== "boolean") throw new TypeError(`${tool.name}.${key} must be a boolean.`);
    }
  }
  return tools;
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Register the full static catalog after the application renderer/fallback is ready.
 * @param {import('./tool-runtime.js').SpatialToolRuntime|any} runtime
 * @param {{readiness?:Promise<unknown>,modelContext?:any,onStatus?:(status:any)=>void}=} options
 */
export async function registerWebMCPTools(runtime, options = {}) {
  const readiness = options.readiness ?? Promise.resolve();
  const onStatus = options.onStatus ?? (() => {});
  await readiness;

  const modelContext = Object.hasOwn(options, "modelContext")
    ? options.modelContext
    : globalThis.document?.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    const result = {
      registered: false,
      count: 0,
      names: [],
      reason: "document.modelContext.registerTool is unavailable",
      dispose() {}
    };
    onStatus({ state: "unsupported", ...result });
    return result;
  }

  let tools;
  try {
    tools = preflightCatalog(runtime.listTools());
  } catch (error) {
    onStatus({ state: "error", error: errorMessage(error) });
    throw error;
  }

  const registrationController = new AbortController();
  onStatus({ state: "registering", count: tools.length });
  let synchronousFailure;
  const registrations = tools.map((tool) => {
    const definition = {
      ...tool,
      execute: (input, context = {}) => runtime.invoke(tool.name, input ?? {}, {
        source: "agent",
        signal: context.signal
      })
    };
    try {
      return Promise.resolve(modelContext.registerTool(definition, {
        signal: registrationController.signal
      })).catch((error) => {
        registrationController.abort(error);
        throw error;
      });
    } catch (error) {
      synchronousFailure ??= error;
      return Promise.reject(error);
    }
  });
  if (synchronousFailure) registrationController.abort(synchronousFailure);

  const settled = await Promise.allSettled(registrations);
  const failure = settled.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    registrationController.abort(failure.reason);
    onStatus({ state: "error", error: errorMessage(failure.reason) });
    throw failure.reason;
  }

  const names = tools.map((tool) => tool.name);
  const result = {
    registered: true,
    count: names.length,
    names,
    dispose() {
      registrationController.abort(new DOMException("WebMCP registration disposed.", "AbortError"));
    }
  };
  onStatus({ state: "active", count: result.count, names: result.names });
  return result;
}
