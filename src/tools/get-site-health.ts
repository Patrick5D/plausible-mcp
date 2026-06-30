/**
 * [INPUT]: 依赖 PlausibleClient 聚合查询与 realtime endpoint 探测单站点状态
 * [OUTPUT]: 对外提供 get_site_health 工具注册函数，返回 stats/realtime/sites cache 级健康摘要
 * [POS]: tools 的站点健康入口，用最小只读查询验证 site_id、API key 和采集状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlausibleApiError, type PlausibleClient } from "../plausible.js";
import { UserFacingError } from "../errors.js";
import { siteIdSchema } from "../schemas.js";
import { resolveSiteId } from "./get-timeseries.js";

type CaptureResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number | undefined };

async function capture<T>(fn: () => Promise<T>): Promise<CaptureResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    const status = error instanceof PlausibleApiError ? error.status : undefined;
    return { ok: false, status };
  }
}

export function register(
  server: McpServer,
  client: PlausibleClient,
  defaultSiteId?: string
) {
  server.registerTool(
    "get_site_health",
    {
      title: "Get Site Health",
      description:
        "Check whether a Plausible site can be queried and whether realtime stats are reachable.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        site_id: siteIdSchema,
      },
    },
    async (args) => {
      try {
        const siteId = resolveSiteId(args.site_id, defaultSiteId);
        const [stats, realtime] = await Promise.all([
          capture(() =>
            client.query({
              site_id: siteId,
              metrics: ["visitors", "pageviews"],
              date_range: "7d",
            })
          ),
          capture(() => client.getRealtimeVisitors(siteId)),
        ]);

        const result = {
          site_id: siteId,
          ok: stats.ok && realtime.ok,
          checks: {
            stats_api: stats.ok
              ? { ok: true, rows: stats.value.results.length, meta: stats.value.meta }
              : { ok: false, status: stats.status },
            realtime_api: realtime.ok
              ? { ok: true, visitors: realtime.value }
              : { ok: false, status: realtime.status },
          },
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          isError: !result.ok,
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
