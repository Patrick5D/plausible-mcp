import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerPages } from "../../src/tools/get-pages.js";
import { register as registerSources } from "../../src/tools/get-sources.js";
import { register as registerCountries } from "../../src/tools/get-countries.js";
import { createMockClient, getToolHandler } from "./_helpers.js";

describe("breakdown preset tools", () => {
  let server: McpServer;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerPages(server, client, "default.com");
    registerSources(server, client, "default.com");
    registerCountries(server, client, "default.com");
  });

  it("get_pages queries event:page", async () => {
    const handler = getToolHandler(server, "get_pages");
    await handler({ date_range: "30d", limit: 5 });

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: "default.com",
        dimensions: ["event:page"],
        pagination: { limit: 5 },
      })
    );
  });

  it("get_sources queries visit:source", async () => {
    const handler = getToolHandler(server, "get_sources");
    await handler({ site_id: "example.com", date_range: "7d" });

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: "example.com",
        dimensions: ["visit:source"],
      })
    );
  });

  it("get_countries applies page filter", async () => {
    const handler = getToolHandler(server, "get_countries");
    await handler({ date_range: "7d", page: "/pricing" });

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        dimensions: ["visit:country"],
        filters: [["is", "event:page", ["/pricing"]]],
      })
    );
  });
});
