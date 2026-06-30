/**
 * [INPUT]: 依赖 @modelcontextprotocol/sdk 的 McpServer，依赖 plausible.ts 的 PlausibleClient，依赖 tools/ 注册只读分析和发现工具
 * [OUTPUT]: 对外提供 createServer 工厂，把 Plausible 配置组装成 MCP server
 * [POS]: src 的核心装配器，被 worker.ts 和 index.ts 入口消费，集中维护工具注册顺序
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlausibleClient } from "./plausible.js";
import { register as registerTimeseries } from "./tools/get-timeseries.js";
import { register as registerBreakdown } from "./tools/get-breakdown.js";
import { register as registerConversions } from "./tools/get-conversions.js";
import { register as registerComparePeriods } from "./tools/compare-periods.js";
import { register as registerListSites } from "./tools/list-sites.js";
import { register as registerAggregate } from "./tools/get-aggregate.js";
import { register as registerRealtimeVisitors } from "./tools/get-realtime-visitors.js";
import { register as registerGoals } from "./tools/get-goals.js";
import { register as registerPages } from "./tools/get-pages.js";
import { register as registerSources } from "./tools/get-sources.js";
import { register as registerCountries } from "./tools/get-countries.js";
import { register as registerDevices } from "./tools/get-devices.js";
import { register as registerEntryExitPages } from "./tools/get-entry-exit-pages.js";
import { register as registerUtmCampaigns } from "./tools/get-utm-campaigns.js";
import { register as registerPageTimeseries } from "./tools/get-page-timeseries.js";
import { register as registerTrafficAnomalies } from "./tools/find-traffic-anomalies.js";

export interface ServerConfig {
  apiKey: string;
  baseUrl?: string;
  defaultSiteId?: string;
  siteIds?: string[];
}

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer({
    name: "plausible-mcp",
    version: "0.2.0",
  });

  const client = new PlausibleClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });

  registerListSites(server, client, config.siteIds);
  registerAggregate(server, client, config.defaultSiteId);
  registerRealtimeVisitors(server, client, config.defaultSiteId);
  registerGoals(server, client, config.defaultSiteId);
  registerPages(server, client, config.defaultSiteId);
  registerSources(server, client, config.defaultSiteId);
  registerCountries(server, client, config.defaultSiteId);
  registerDevices(server, client, config.defaultSiteId);
  registerEntryExitPages(server, client, config.defaultSiteId);
  registerUtmCampaigns(server, client, config.defaultSiteId);
  registerPageTimeseries(server, client, config.defaultSiteId);
  registerTrafficAnomalies(server, client, config.defaultSiteId);
  registerTimeseries(server, client, config.defaultSiteId);
  registerBreakdown(server, client, config.defaultSiteId);
  registerConversions(server, client, config.defaultSiteId);
  registerComparePeriods(server, client, config.defaultSiteId);

  return server;
}
