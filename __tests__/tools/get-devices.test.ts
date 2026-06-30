import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/get-devices.js";
import { createMockClient, getToolHandler } from "./_helpers.js";

describe("get_devices tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    register(server, client, "default.com");
  });

  it("queries device, browser, and os dimensions", async () => {
    const handler = getToolHandler(server, "get_devices");
    const result = await handler({ date_range: "30d", limit: 3 });

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ dimensions: ["visit:device"], pagination: { limit: 3 } })
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ dimensions: ["visit:browser"], pagination: { limit: 3 } })
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ dimensions: ["visit:os"], pagination: { limit: 3 } })
    );

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed["visit:device"]).toBeDefined();
    expect(parsed["visit:browser"]).toBeDefined();
    expect(parsed["visit:os"]).toBeDefined();
  });
});
