/**
 * [INPUT]: 依赖 PlausibleClient 聚合查询能力、共享 schema 和页面/目标 filter builder
 * [OUTPUT]: 对外提供 get_aggregate 工具注册函数，返回某站点某时间段的总览指标
 * [POS]: tools 的总览查询器，是 get_timeseries 的无维度兄弟工具，适合回答总体表现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlausibleApiError, type PlausibleClient } from "../plausible.js";
import { UserFacingError } from "../errors.js";
import {
  siteIdSchema,
  dateRangeSchema,
  pageSchema,
  goalSchema,
  metricsSchema,
  buildPageFilter,
  buildGoalFilter,
} from "../schemas.js";
import { resolveSiteId } from "./get-timeseries.js";

const DEFAULT_AGGREGATE_METRICS = [
  "visitors",
  "visits",
  "pageviews",
  "views_per_visit",
  "bounce_rate",
  "visit_duration",
];

export function register(
  server: McpServer,
  client: PlausibleClient,
  defaultSiteId?: string
) {
  server.registerTool(
    "get_aggregate",
    {
      title: "Get Aggregate",
      description:
        "Get aggregate traffic and conversion metrics for a site over a date range. Use for overall visitors, pageviews, bounce rate, and duration.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        site_id: siteIdSchema,
        date_range: dateRangeSchema,
        page: pageSchema,
        metrics: metricsSchema,
        goal: goalSchema,
      },
    },
    async (args) => {
      try {
        const siteId = resolveSiteId(args.site_id, defaultSiteId);
        const metrics = args.metrics ?? DEFAULT_AGGREGATE_METRICS;
        const filters: unknown[][] = [];
        if (args.page) filters.push(buildPageFilter(args.page));
        if (args.goal) filters.push(buildGoalFilter(args.goal));

        const result = await client.query({
          site_id: siteId,
          metrics,
          date_range: args.date_range,
          filters,
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
