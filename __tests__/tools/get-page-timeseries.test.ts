import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/get-page-timeseries.js";
import { createMockClient, getToolHandler } from "./_helpers.js";

describe("get_page_timeseries tool", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    register(server, client, "default.com");
  });

  it("queries page-filtered timeseries", async () => {
    const handler = getToolHandler(server, "get_page_timeseries");
    await handler({ date_range: "30d", page: "/pricing", granularity: "week" });

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: "default.com",
        dimensions: ["time:week"],
        filters: [["is", "event:page", ["/pricing"]]],
      })
    );
  });
});
