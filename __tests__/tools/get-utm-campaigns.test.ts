import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/get-utm-campaigns.js";
import { createMockClient, getToolHandler } from "./_helpers.js";

describe("get_utm_campaigns tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    register(server, client, "default.com");
  });

  it("queries all UTM dimensions", async () => {
    const handler = getToolHandler(server, "get_utm_campaigns");
    const result = await handler({ date_range: "30d" });

    expect(client.query).toHaveBeenCalledTimes(5);
    for (const dimension of [
      "visit:utm_medium",
      "visit:utm_source",
      "visit:utm_campaign",
      "visit:utm_content",
      "visit:utm_term",
    ]) {
      expect(client.query).toHaveBeenCalledWith(
        expect.objectContaining({ dimensions: [dimension] })
      );
    }
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed["visit:utm_campaign"]).toBeDefined();
  });
});
