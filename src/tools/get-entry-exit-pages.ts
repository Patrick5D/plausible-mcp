/**
 * [INPUT]: 依赖 PlausibleClient、共享 schema 和 page filter builder 查询 entry/exit page 维度
 * [OUTPUT]: 对外提供 get_entry_exit_pages 工具注册函数，返回入口页与退出页排行
 * [POS]: tools 的落地页诊断入口，一次封装 visit:entry_page 与 visit:exit_page
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlausibleApiError, type PlausibleClient } from "../plausible.js";
import { UserFacingError } from "../errors.js";
import {
  buildPageFilter,
  dateRangeSchema,
  metricsSchema,
  pageSchema,
  siteIdSchema,
} from "../schemas.js";
import { resolveSiteId } from "./get-timeseries.js";

export function register(
  server: McpServer,
  client: PlausibleClient,
  defaultSiteId?: string
) {
  server.registerTool(
    "get_entry_exit_pages",
    {
      title: "Get Entry Exit Pages",
      description:
        "Get entry page and exit page rankings for a Plausible site. Use for landing page and drop-off diagnostics.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        site_id: siteIdSchema,
        date_range: dateRangeSchema,
        page: pageSchema,
        metrics: metricsSchema,
        limit: z.number().int().min(1).max(1000).default(20).optional(),
      },
    },
    async (args) => {
      try {
        const siteId = resolveSiteId(args.site_id, defaultSiteId);
        const filters: unknown[][] = [];
        if (args.page) filters.push(buildPageFilter(args.page));
        const metrics = args.metrics ?? ["visitors", "visits", "bounce_rate"];
        const pagination = { limit: args.limit ?? 20 };

        const [entry_pages, exit_pages] = await Promise.all([
          client.query({
            site_id: siteId,
            metrics,
            date_range: args.date_range,
            dimensions: ["visit:entry_page"],
            filters,
            pagination,
          }),
          client.query({
            site_id: siteId,
            metrics,
            date_range: args.date_range,
            dimensions: ["visit:exit_page"],
            filters,
            pagination,
          }),
        ]);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ entry_pages, exit_pages }, null, 2),
            },
          ],
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
