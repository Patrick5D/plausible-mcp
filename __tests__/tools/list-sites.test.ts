import { describe, it, expect, beforeEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/list-sites.js";
import { createMockClient, getToolHandler } from "./_helpers.js";
import { PlausibleApiError } from "../../src/plausible.js";

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

  it("falls back to configured site ids when Sites API is unavailable", async () => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    client.listSites = vi.fn().mockRejectedValue(new PlausibleApiError(404, "not found"));
    register(server, client, ["example.com", "docs.example.com"]);

    const handler = getToolHandler(server, "list_sites");
    const result = await handler({ limit: 1 });
    const parsed = JSON.parse(result.content[0].text);

    expect(result.isError).toBeFalsy();
    expect(parsed.sites).toEqual([{ domain: "example.com" }]);
    expect(parsed.meta.source).toBe("PLAUSIBLE_SITE_IDS");
  });

  it("does not fallback on authentication errors", async () => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    client.listSites = vi.fn().mockRejectedValue(new PlausibleApiError(401, "bad key"));
    register(server, client, ["example.com"]);

    const handler = getToolHandler(server, "list_sites");
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("401");
  });
});
