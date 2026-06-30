/**
 * [INPUT]: 依赖 zod schema、PlausibleClient 和 resolveSiteId 查询设备/浏览器/系统维度
 * [OUTPUT]: 对外提供 get_devices 工具注册函数，返回 device/browser/os 三类技术环境排行
 * [POS]: tools 的设备语义入口，一次封装多个技术维度，减少调用者手工选择 dimension
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

const DEVICE_DIMENSIONS = ["visit:device", "visit:browser", "visit:os"] as const;

export function register(
  server: McpServer,
  client: PlausibleClient,
  defaultSiteId?: string
) {
  server.registerTool(
    "get_devices",
    {
      title: "Get Devices",
      description:
        "Get device, browser, and operating system breakdowns for a Plausible site.",
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
          .describe("Max results per device dimension")
          .optional(),
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
          DEVICE_DIMENSIONS.map(async (dimension) => {
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
