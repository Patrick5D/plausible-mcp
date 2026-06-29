import { vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlausibleClient } from "../../src/plausible.js";

export function createMockClient(
  returnValue?: unknown
): PlausibleClient & {
  query: ReturnType<typeof vi.fn>;
  listSites: ReturnType<typeof vi.fn>;
  listGoals: ReturnType<typeof vi.fn>;
  getRealtimeVisitors: ReturnType<typeof vi.fn>;
} {
  return {
    query: vi.fn().mockResolvedValue(
      returnValue ?? {
        results: [
          { dimensions: ["2024-01-01"], metrics: [100, 200, 45.5, 120] },
        ],
        meta: {},
        query: {},
      }
    ),
    listSites: vi.fn().mockResolvedValue({
      sites: [{ domain: "example.com", timezone: "Etc/UTC" }],
      meta: {},
    }),
    listGoals: vi.fn().mockResolvedValue({
      goals: [{ id: 1, display_name: "Signup", goal_type: "event" }],
      meta: {},
    }),
    getRealtimeVisitors: vi.fn().mockResolvedValue(3),
  } as unknown as PlausibleClient & {
    query: ReturnType<typeof vi.fn>;
    listSites: ReturnType<typeof vi.fn>;
    listGoals: ReturnType<typeof vi.fn>;
    getRealtimeVisitors: ReturnType<typeof vi.fn>;
  };
}

export function getToolHandler(server: McpServer, toolName: string) {
  const tools = (server as any)._registeredTools as Record<string, any>;
  const tool = tools?.[toolName];
  if (!tool) throw new Error(`Tool ${toolName} not registered`);
  return async (args: Record<string, unknown>) => {
    return tool.handler(args, {} as any);
  };
}
