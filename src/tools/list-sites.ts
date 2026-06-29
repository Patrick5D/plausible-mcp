/**
 * [INPUT]: 依赖 PlausibleClient 的 Sites API 读取能力和 zod 输入校验
 * [OUTPUT]: 对外提供 list_sites 工具注册函数，列出 API key 可访问的站点
 * [POS]: tools 的站点发现入口，被 server.ts 注册，解决后续查询前的 site_id 发现问题
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlausibleApiError, type PlausibleClient, type PlausibleSitesResponse } from "../plausible.js";

export function register(
  server: McpServer,
  client: PlausibleClient,
  configuredSiteIds: string[] = []
) {
  server.registerTool(
    "list_sites",
    {
      title: "List Sites",
      description:
        "List Plausible sites accessible to the current API key. Use this before analytics queries when the site_id is unknown.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(100)
          .describe("Maximum number of sites to return"),
      },
    },
    async (args) => {
      try {
        const result = await client.listSites(args.limit ?? 100);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        if (configuredSiteIds.length && error instanceof PlausibleApiError) {
          const result: PlausibleSitesResponse = {
            sites: configuredSiteIds.slice(0, args.limit ?? 100).map((domain) => ({ domain })),
            meta: { source: "PLAUSIBLE_SITE_IDS", api_error_status: error.status },
          };
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        }

        const message =
          error instanceof PlausibleApiError
            ? `Plausible API returned ${error.status}. This endpoint may require a Sites API key, or set PLAUSIBLE_SITE_IDS for self-hosted CE.`
            : "An unexpected error occurred";
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
