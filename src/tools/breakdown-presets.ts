/**
 * [INPUT]: 依赖 McpServer、PlausibleClient、共享 schema 和 page filter builder
 * [OUTPUT]: 对外提供 registerBreakdownPreset，统一注册固定维度 breakdown 工具
 * [POS]: tools 的语义 wrapper 工厂，被 pages/sources/countries/devices 等工具复用
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

interface BreakdownPresetConfig {
  name: string;
  title: string;
  description: string;
  dimension: string;
  defaultMetrics: string[];
}

export function registerBreakdownPreset(
  server: McpServer,
  client: PlausibleClient,
  config: BreakdownPresetConfig,
  defaultSiteId?: string
) {
  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      annotations: { readOnlyHint: true },
      inputSchema: {
        site_id: siteIdSchema,
        date_range: dateRangeSchema,
        page: pageSchema,
        metrics: metricsSchema,
        limit: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .default(20)
          .describe("Max results to return")
          .optional(),
      },
    },
    async (args) => {
      try {
        const siteId = resolveSiteId(args.site_id, defaultSiteId);
        const filters: unknown[][] = [];
        if (args.page) filters.push(buildPageFilter(args.page));

        const result = await client.query({
          site_id: siteId,
          metrics: args.metrics ?? config.defaultMetrics,
          date_range: args.date_range,
          dimensions: [config.dimension],
          filters,
          pagination: { limit: args.limit ?? 20 },
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
