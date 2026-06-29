import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/get-realtime-visitors.js";
import { createMockClient, getToolHandler } from "./_helpers.js";

describe("get_realtime_visitors tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    register(server, client, "default.com");
  });

  it("returns realtime visitor count", async () => {
    const handler = getToolHandler(server, "get_realtime_visitors");
    const result = await handler({ site_id: "example.com" });

    expect(client.getRealtimeVisitors).toHaveBeenCalledWith("example.com");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({ site_id: "example.com", visitors: 3 });
  });

  it("uses default site_id", async () => {
    const handler = getToolHandler(server, "get_realtime_visitors");
    await handler({});

    expect(client.getRealtimeVisitors).toHaveBeenCalledWith("default.com");
  });
});
