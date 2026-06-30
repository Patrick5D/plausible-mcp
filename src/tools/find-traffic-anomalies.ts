/**
 * [INPUT]: 依赖 PlausibleClient 查询两个时间段的固定维度 breakdown
 * [OUTPUT]: 对外提供 find_traffic_anomalies 工具注册函数，计算维度项的涨跌幅排行
 * [POS]: tools 的分析型入口，把基础统计 API 组合成 before/after 异常发现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlausibleApiError, type PlausibleClient, type PlausibleResponse } from "../plausible.js";
import { UserFacingError } from "../errors.js";
import {
  buildPageFilter,
  dateRangeSchema,
  pageSchema,
  siteIdSchema,
} from "../schemas.js";
import { resolveSiteId } from "./get-timeseries.js";

const ANOMALY_DIMENSIONS = [
  "event:page",
  "visit:source",
  "visit:country",
  "visit:device",
] as const;

const ANOMALY_METRICS = ["visitors", "pageviews", "visits", "events"] as const;

interface MetricRow {
  key: string;
  value: number;
}

function metricRows(response: PlausibleResponse): MetricRow[] {
  return response.results.map((row) => ({
    key: String(row.dimensions[0] ?? ""),
    value: row.metrics[0] ?? 0,
  }));
}

function compareRows(current: MetricRow[], previous: MetricRow[]) {
  const currentByKey = new Map(current.map((row) => [row.key, row.value]));
  const previousByKey = new Map(previous.map((row) => [row.key, row.value]));
  const keys = new Set([...currentByKey.keys(), ...previousByKey.keys()]);

  return [...keys]
    .map((key) => {
      const currentValue = currentByKey.get(key) ?? 0;
      const previousValue = previousByKey.get(key) ?? 0;
      const absolute_change = currentValue - previousValue;
      const percent_change =
        previousValue === 0 ? null : (absolute_change / previousValue) * 100;
      return {
        dimension: key,
        current: currentValue,
        previous: previousValue,
        absolute_change,
        percent_change,
      };
    })
    .sort((a, b) => Math.abs(b.absolute_change) - Math.abs(a.absolute_change));
}

export function register(
  server: McpServer,
  client: PlausibleClient,
  defaultSiteId?: string
) {
  server.registerTool(
    "find_traffic_anomalies",
    {
      title: "Find Traffic Anomalies",
      description:
        "Compare a dimension between two date ranges and return the biggest traffic increases or drops.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        site_id: siteIdSchema,
        current_range: dateRangeSchema.describe("Current date range to analyze"),
        previous_range: dateRangeSchema.describe("Previous date range to compare against"),
        dimension: z.enum(ANOMALY_DIMENSIONS).default("event:page"),
        metric: z.enum(ANOMALY_METRICS).default("visitors"),
        page: pageSchema,
        limit: z.number().int().min(1).max(1000).default(20).optional(),
      },
    },
    async (args) => {
      try {
        const siteId = resolveSiteId(args.site_id, defaultSiteId);
        const filters: unknown[][] = [];
        if (args.page) filters.push(buildPageFilter(args.page));
        const pagination = { limit: args.limit ?? 20 };
        const metrics = [args.metric ?? "visitors"];

        const [current, previous] = await Promise.all([
          client.query({
            site_id: siteId,
            metrics,
            date_range: args.current_range,
            dimensions: [args.dimension ?? "event:page"],
            filters,
            pagination,
          }),
          client.query({
            site_id: siteId,
            metrics,
            date_range: args.previous_range,
            dimensions: [args.dimension ?? "event:page"],
            filters,
            pagination,
          }),
        ]);

        const result = {
          site_id: siteId,
          dimension: args.dimension ?? "event:page",
          metric: args.metric ?? "visitors",
          current_range: args.current_range,
          previous_range: args.previous_range,
          anomalies: compareRows(metricRows(current), metricRows(previous)).slice(
            0,
            args.limit ?? 20
          ),
        };

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
