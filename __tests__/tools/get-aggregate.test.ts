import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/get-aggregate.js";
import { createMockClient, getToolHandler } from "./_helpers.js";

describe("get_aggregate tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    register(server, client, "default.com");
  });

  it("calls client.query without dimensions", async () => {
    const handler = getToolHandler(server, "get_aggregate");
    await handler({ site_id: "example.com", date_range: "30d" });

    expect(client.query).toHaveBeenCalledWith({
      site_id: "example.com",
      metrics: [
        "visitors",
        "visits",
        "pageviews",
        "views_per_visit",
        "bounce_rate",
        "visit_duration",
      ],
      date_range: "30d",
      filters: [],
    });
  });

  it("uses default site_id and filters", async () => {
    const handler = getToolHandler(server, "get_aggregate");
    await handler({ date_range: "7d", page: "/pricing", goal: "Signup" });

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: "default.com",
        filters: [
          ["is", "event:page", ["/pricing"]],
          ["is", "event:goal", ["Signup"]],
        ],
      })
    );
  });

  it("uses custom metrics", async () => {
    const handler = getToolHandler(server, "get_aggregate");
    await handler({
      site_id: "example.com",
      date_range: "7d",
      metrics: ["visitors", "events"],
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({ metrics: ["visitors", "events"] })
    );
  });
});
