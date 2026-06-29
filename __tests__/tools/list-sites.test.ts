import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/list-sites.js";
import { createMockClient, getToolHandler } from "./_helpers.js";

describe("list_sites tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    register(server, client);
  });

  it("calls client.listSites with default limit", async () => {
    const handler = getToolHandler(server, "list_sites");
    const result = await handler({});

    expect(client.listSites).toHaveBeenCalledWith(100);
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.sites[0].domain).toBe("example.com");
  });

  it("uses custom limit", async () => {
    const handler = getToolHandler(server, "list_sites");
    await handler({ limit: 10 });

    expect(client.listSites).toHaveBeenCalledWith(10);
  });
});
