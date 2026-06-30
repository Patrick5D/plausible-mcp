import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/find-traffic-anomalies.js";
import { createMockClient, getToolHandler } from "./_helpers.js";

describe("find_traffic_anomalies tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    client.query
      .mockResolvedValueOnce({
        results: [
          { dimensions: ["/pricing"], metrics: [150] },
          { dimensions: ["/blog"], metrics: [50] },
        ],
        meta: {},
        query: {},
      })
      .mockResolvedValueOnce({
        results: [
          { dimensions: ["/pricing"], metrics: [100] },
          { dimensions: ["/blog"], metrics: [100] },
        ],
        meta: {},
        query: {},
      });
    register(server, client, "default.com");
  });

  it("compares two periods and sorts by absolute change", async () => {
    const handler = getToolHandler(server, "find_traffic_anomalies");
    const result = await handler({
      current_range: "7d",
      previous_range: "2026-06-01,2026-06-07",
      dimension: "event:page",
      metric: "visitors",
    });

    expect(client.query).toHaveBeenCalledTimes(2);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.anomalies).toEqual([
      {
        dimension: "/pricing",
        current: 150,
        previous: 100,
        absolute_change: 50,
        percent_change: 50,
      },
      {
        dimension: "/blog",
        current: 50,
        previous: 100,
        absolute_change: -50,
        percent_change: -50,
      },
    ]);
  });
});
