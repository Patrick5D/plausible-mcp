import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/get-entry-exit-pages.js";
import { createMockClient, getToolHandler } from "./_helpers.js";

describe("get_entry_exit_pages tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    register(server, client, "default.com");
  });

  it("queries entry and exit pages", async () => {
    const handler = getToolHandler(server, "get_entry_exit_pages");
    const result = await handler({ date_range: "30d", limit: 5 });

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ dimensions: ["visit:entry_page"], pagination: { limit: 5 } })
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ dimensions: ["visit:exit_page"], pagination: { limit: 5 } })
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.entry_pages).toBeDefined();
    expect(parsed.exit_pages).toBeDefined();
  });
});
