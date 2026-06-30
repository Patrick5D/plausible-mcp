/**
 * [INPUT]: 依赖 server.ts 传入的脱敏运行配置
 * [OUTPUT]: 对外提供 get_mcp_config 工具注册函数，返回 MCP 当前非敏感配置摘要
 * [POS]: tools 的配置诊断入口，帮助调用者理解默认站点、base URL 和配置站点数量
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface McpConfigSummary {
  baseUrl: string;
  defaultSiteId?: string;
  configuredSiteCount: number;
  configuredSitesAvailable: boolean;
}

export function register(server: McpServer, config: McpConfigSummary) {
  server.registerTool(
    "get_mcp_config",
    {
      title: "Get MCP Config",
      description:
        "Get non-sensitive MCP runtime configuration such as Plausible base URL, default site, and configured site count.",
      annotations: { readOnlyHint: true },
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text" as const, text: JSON.stringify(config, null, 2) }],
    })
  );
}
