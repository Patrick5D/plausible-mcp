/**
 * [INPUT]: 依赖 PlausibleClient 和共享 schema 查询 UTM 维度
 * [OUTPUT]: 对外提供 get_utm_campaigns 工具注册函数，返回 medium/source/campaign/content/term 排行
 * [POS]: tools 的投放归因入口，一次封装 Plausible UTM breakdown 族
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

const UTM_DIMENSIONS = [
  "visit:utm_medium",
  "visit:utm_source",
  "visit:utm_campaign",
  "visit:utm_content",
  "visit:utm_term",
] as const;

export function register(
  server: McpServer,
  client: PlausibleClient,
  defaultSiteId?: string
) {
  server.registerTool(
    "get_utm_campaigns",
    {
      title: "Get UTM Campaigns",
      description:
        "Get UTM medium, source, campaign, content, and term breakdowns for campaign attribution.",
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
        const limit = args.limit ?? 20;

        const entries = await Promise.all(
          UTM_DIMENSIONS.map(async (dimension) => {
            const result = await client.query({
              site_id: siteId,
              metrics,
              date_range: args.date_range,
              dimensions: [dimension],
              filters,
              pagination: { limit },
            });
            return [dimension, result] as const;
          })
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(Object.fromEntries(entries), null, 2),
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
