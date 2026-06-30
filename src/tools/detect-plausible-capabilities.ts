/**
 * [INPUT]: 依赖 PlausibleClient 的 Stats、Realtime、Sites 和 Goals endpoint 探测能力
 * [OUTPUT]: 对外提供 detect_plausible_capabilities 工具注册函数，返回当前实例 API 能力矩阵
 * [POS]: tools 的实例诊断入口，区分 self-hosted CE 缺少管理 API 与统计 API 故障
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlausibleApiError, type PlausibleClient } from "../plausible.js";
import { UserFacingError } from "../errors.js";
import { siteIdSchema } from "../schemas.js";
import { resolveSiteId } from "./get-timeseries.js";

async function probe<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, value: await fn() };
  } catch (error) {
    return {
      ok: false as const,
      status: error instanceof PlausibleApiError ? error.status : undefined,
    };
  }
}

export function register(
  server: McpServer,
  client: PlausibleClient,
  defaultSiteId?: string
) {
  server.registerTool(
    "detect_plausible_capabilities",
    {
      title: "Detect Plausible Capabilities",
      description:
        "Detect which Plausible APIs are available for this instance and API key: stats, realtime, sites, and goals.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        site_id: siteIdSchema,
      },
    },
    async (args) => {
      try {
        const siteId = resolveSiteId(args.site_id, defaultSiteId);
        const [stats, realtime, sites, goals] = await Promise.all([
          probe(() =>
            client.query({
              site_id: siteId,
              metrics: ["visitors"],
              date_range: "7d",
            })
          ),
          probe(() => client.getRealtimeVisitors(siteId)),
          probe(() => client.listSites(1)),
          probe(() => client.listGoals(siteId, 1)),
        ]);

        const result = {
          site_id: siteId,
          capabilities: {
            stats_api: stats.ok
              ? { ok: true, api_version: stats.value.meta.api_version ?? "v2" }
              : { ok: false, status: stats.status },
            realtime_api: realtime.ok
              ? { ok: true }
              : { ok: false, status: realtime.status },
            sites_api: sites.ok
              ? { ok: true }
              : { ok: false, status: sites.status },
            goals_api: goals.ok
              ? { ok: true }
              : { ok: false, status: goals.status },
          },
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message =
          error instanceof UserFacingError
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
