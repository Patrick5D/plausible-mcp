import { describe, it, expect, beforeEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/get-site-health.js";
import { createMockClient, getToolHandler } from "./_helpers.js";
import { PlausibleApiError } from "../../src/plausible.js";

describe("get_site_health tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    register(server, client, "default.com");
  });

  it("returns healthy stats and realtime checks", async () => {
    const handler = getToolHandler(server, "get_site_health");
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.ok).toBe(true);
    expect(parsed.checks.stats_api.ok).toBe(true);
    expect(parsed.checks.realtime_api.ok).toBe(true);
  });

  it("returns structured failure when realtime fails", async () => {
    client.getRealtimeVisitors = vi
      .fn()
      .mockRejectedValue(new PlausibleApiError(404, "not found"));
    const handler = getToolHandler(server, "get_site_health");
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(parsed.ok).toBe(false);
    expect(parsed.checks.realtime_api).toEqual({ ok: false, status: 404 });
  });
});
