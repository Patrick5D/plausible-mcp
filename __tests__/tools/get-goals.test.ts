import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/get-goals.js";
import { createMockClient, getToolHandler } from "./_helpers.js";

describe("get_goals tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    register(server, client, "default.com");
  });

  it("lists goals for a site", async () => {
    const handler = getToolHandler(server, "get_goals");
    const result = await handler({ site_id: "example.com" });

    expect(client.listGoals).toHaveBeenCalledWith("example.com", 100);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.goals[0].display_name).toBe("Signup");
  });

  it("uses default site_id and custom limit", async () => {
    const handler = getToolHandler(server, "get_goals");
    await handler({ limit: 5 });

    expect(client.listGoals).toHaveBeenCalledWith("default.com", 5);
  });
});
