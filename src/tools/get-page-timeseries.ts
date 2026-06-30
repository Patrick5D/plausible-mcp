/**
 * [INPUT]: 依赖 PlausibleClient、page filter builder 和时间粒度 schema 查询单页趋势
 * [OUTPUT]: 对外提供 get_page_timeseries 工具注册函数，强制 page 参数并返回该页面时间序列
 * [POS]: tools 的页面趋势语义入口，是 get_timeseries + page 的显式封装
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
  DEFAULT_METRICS,
} from "../schemas.js";
import { resolveSiteId } from "./get-timeseries.js";

export function register(
  server: McpServer,
  client: PlausibleClient,
  defaultSiteId?: string
) {
  server.registerTool(
    "get_page_timeseries",
    {
      title: "Get Page Timeseries",
      description:
        "Get traffic metrics over time for a specific page path. Use for page-level trend questions.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        site_id: siteIdSchema,
        date_range: dateRangeSchema,
        page: pageSchema.unwrap().describe("Page path to query, e.g. /pricing or /blog*"),
        granularity: z.enum(["day", "week", "month"]).default("day"),
        metrics: metricsSchema,
      },
    },
    async (args) => {
      try {
        const siteId = resolveSiteId(args.site_id, defaultSiteId);
        const result = await client.query({
          site_id: siteId,
          metrics: args.metrics ?? DEFAULT_METRICS,
          date_range: args.date_range,
          dimensions: [`time:${args.granularity ?? "day"}`],
          filters: [buildPageFilter(args.page)],
        });

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
