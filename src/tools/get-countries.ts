/**
 * [INPUT]: 依赖 breakdown-presets 固定 visit:country 维度查询
 * [OUTPUT]: 对外提供 get_countries 工具注册函数，返回国家流量排行
 * [POS]: tools 的地域语义入口，是 get_breakdown(visit:country) 的易用封装
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlausibleClient } from "../plausible.js";
import { registerBreakdownPreset } from "./breakdown-presets.js";

export function register(
  server: McpServer,
  client: PlausibleClient,
  defaultSiteId?: string
) {
  registerBreakdownPreset(
    server,
    client,
    {
      name: "get_countries",
      title: "Get Countries",
      description:
        "Get top countries for a Plausible site. Use to understand geographic traffic distribution.",
      dimension: "visit:country",
      defaultMetrics: ["visitors", "visits", "bounce_rate"],
    },
    defaultSiteId
  );
}
