/**
 * [INPUT]: 依赖 PlausibleClient 的 Sites goals API 和 resolveSiteId 站点解析
 * [OUTPUT]: 对外提供 get_goals 工具注册函数，列出某站点已配置的目标
 * [POS]: tools 的转化目标发现入口，被 get_conversions 的 goal 参数查询前使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";
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
    "get_goals",
    {
      title: "Get Goals",
      description:
        "List goals configured for a Plausible site. Use before get_conversions when the goal name is unknown.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        site_id: siteIdSchema,
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(100)
          .describe("Maximum number of goals to return"),
      },
    },
    async (args) => {
      try {
        const siteId = resolveSiteId(args.site_id, defaultSiteId);
        const result = await client.listGoals(siteId, args.limit ?? 100);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message =
          error instanceof PlausibleApiError
            ? `Plausible API returned ${error.status}. This endpoint may require a Sites API key.`
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
