# src/tools/
> L2 | 父级: ../../CLAUDE.md

成员清单
list-sites.ts: 站点发现工具，优先调用 Plausible Sites API，不可用时返回 PLAUSIBLE_SITE_IDS 配置。
get-aggregate.ts: 聚合指标工具，无维度查询 Stats API，返回站点或页面在时间段内的总览。
get-realtime-visitors.ts: 实时访客工具，调用 realtime visitors endpoint，返回最近 5 分钟活跃人数。
get-goals.ts: 目标发现工具，优先调用 Sites goals API，不可用时用 event:goal breakdown 推断。
breakdown-presets.ts: 固定维度语义工具工厂，消除 pages/sources/countries 的重复注册逻辑。
get-pages.ts: 页面排行工具，固定 event:page 维度，服务 SEO 和内容页流量问题。
get-sources.ts: 来源排行工具，固定 visit:source 维度，服务渠道来源问题。
get-countries.ts: 国家排行工具，固定 visit:country 维度，服务市场分布问题。
get-devices.ts: 技术环境工具，同时查询 device/browser/os 三类维度。
get-timeseries.ts: 时间序列工具，按 day/week/month 维度查询趋势，并暴露 resolveSiteId。
get-breakdown.ts: 维度拆分工具，按 page/source/country/device/browser 等维度查询排行。
get-conversions.ts: 转化查询工具，按 goal/page 查询转化率和转化次数。
compare-periods.ts: 时间段对比工具，分别查询两个时间窗并计算绝对值与百分比差异。

法则: 每个工具只做输入 schema、参数组装、错误文案和 JSON 输出；API 差异统一收敛到 ../plausible.ts。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
