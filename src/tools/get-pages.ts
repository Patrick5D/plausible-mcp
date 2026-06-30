/**
 * [INPUT]: 依赖 breakdown-presets 固定 event:page 维度查询
 * [OUTPUT]: 对外提供 get_pages 工具注册函数，返回页面流量排行
 * [POS]: tools 的页面语义入口，是 get_breakdown(event:page) 的易用封装
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
      name: "get_pages",
      title: "Get Pages",
      description:
        "Get top pages for a Plausible site. Use for page traffic rankings without manually choosing event:page.",
      dimension: "event:page",
      defaultMetrics: ["visitors", "pageviews", "bounce_rate", "time_on_page"],
    },
    defaultSiteId
  );
}
