// @ts-check

/**
 * Convert an internal payload into a compact WebMCP-compatible result.
 * structuredContent is included for clients that support it, while content
 * keeps the result readable in text-only clients.
 */
function toToolResult(payload) {
  const text = JSON.stringify(payload);
  return {
    content: [{ type: "text", text }],
    structuredContent: payload
  };
}

/**
 * Register all semantic tools on the experimental page model context.
 * @param {import('./tool-runtime.js').SpatialToolRuntime} runtime
 */
export function registerWebMCPTools(runtime) {
  const modelContext = globalThis.document?.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    return { registered: false, count: 0, reason: "document.modelContext.registerTool is unavailable" };
  }

  const registeredNames = [];
  for (const tool of runtime.tools) {
    modelContext.registerTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      execute: async (args) => {
        try {
          return toToolResult(await runtime.invoke(tool.name, args ?? {}));
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
                tool: tool.name
              })
            }]
          };
        }
      }
    });
    registeredNames.push(tool.name);
  }

  return { registered: true, count: registeredNames.length, names: registeredNames };
}
