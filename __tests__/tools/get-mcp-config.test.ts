import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "../../src/tools/get-mcp-config.js";
import { getToolHandler } from "./_helpers.js";

describe("get_mcp_config tool", () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    register(server, {
      baseUrl: "https://plausible.example.com",
      defaultSiteId: "example.com",
      configuredSiteCount: 2,
      configuredSitesAvailable: true,
    });
  });

  it("returns non-sensitive config", async () => {
    const handler = getToolHandler(server, "get_mcp_config");
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed).toEqual({
      baseUrl: "https://plausible.example.com",
      defaultSiteId: "example.com",
      configuredSiteCount: 2,
      configuredSitesAvailable: true,
    });
    expect(result.content[0].text).not.toContain("apiKey");
    expect(result.content[0].text).not.toContain("Bearer");
  });
});
