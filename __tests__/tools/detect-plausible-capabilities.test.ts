import { describe, it, expect, beforeEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/detect-plausible-capabilities.js";
import { createMockClient, getToolHandler } from "./_helpers.js";
import { PlausibleApiError } from "../../src/plausible.js";

describe("detect_plausible_capabilities tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient({
      results: [{ dimensions: [], metrics: [10] }],
      meta: { api_version: "v1" },
      query: {},
    });
    register(server, client, "default.com");
  });

  it("reports capability statuses", async () => {
    client.listSites = vi.fn().mockRejectedValue(new PlausibleApiError(404, "not found"));
    const handler = getToolHandler(server, "detect_plausible_capabilities");
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.capabilities.stats_api).toEqual({ ok: true, api_version: "v1" });
    expect(parsed.capabilities.realtime_api).toEqual({ ok: true });
    expect(parsed.capabilities.sites_api).toEqual({ ok: false, status: 404 });
    expect(parsed.capabilities.goals_api).toEqual({ ok: true });
  });
});
