/**
 * [INPUT]: 依赖 breakdown-presets 固定 visit:source 维度查询
 * [OUTPUT]: 对外提供 get_sources 工具注册函数，返回来源流量排行
 * [POS]: tools 的来源语义入口，是 get_breakdown(visit:source) 的易用封装
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
      name: "get_sources",
      title: "Get Sources",
      description:
        "Get top traffic sources for a Plausible site. Use for referrer/source acquisition rankings.",
      dimension: "visit:source",
      defaultMetrics: ["visitors", "visits", "bounce_rate", "visit_duration"],
    },
    defaultSiteId
  );
}
