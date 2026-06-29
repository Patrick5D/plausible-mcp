/**
 * [INPUT]: 依赖 PlausibleClient 的 realtime visitors endpoint 和 resolveSiteId 站点解析
 * [OUTPUT]: 对外提供 get_realtime_visitors 工具注册函数，返回最近 5 分钟活跃访客数
 * [POS]: tools 的实时读数入口，被 server.ts 注册，补足历史统计之外的在线人数查询
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlausibleApiError, type PlausibleClient } from "../plausible.js";
import { UserFacingError } from "../errors.js";
import { siteIdSchema } from "../schemas.js";
import { resolveSiteId } from "./get-timeseries.js";

export function register(
  server: McpServer,
  client: PlausibleClient,
  defaultSiteId?: string
) {
  server.registerTool(
    "get_realtime_visitors",
    {
      title: "Get Realtime Visitors",
      description:
        "Get the number of current visitors on a Plausible site, defined by Plausible as visitors active in the last 5 minutes.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        site_id: siteIdSchema,
      },
    },
    async (args) => {
      try {
        const siteId = resolveSiteId(args.site_id, defaultSiteId);
        const visitors = await client.getRealtimeVisitors(siteId);
        const result = { site_id: siteId, visitors };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message =
          error instanceof PlausibleApiError
            ? `Plausible API returned ${error.status}`
            : error instanceof UserFacingError
              ? error.message
              : "An unexpected error occurred";
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
