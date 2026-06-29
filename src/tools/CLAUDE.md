# src/tools/
> L2 | 父级: ../../CLAUDE.md

成员清单
list-sites.ts: 站点发现工具，调用 Plausible Sites API，返回当前 API key 可访问的站点。
get-aggregate.ts: 聚合指标工具，无维度查询 Stats API，返回站点或页面在时间段内的总览。
get-realtime-visitors.ts: 实时访客工具，调用 realtime visitors endpoint，返回最近 5 分钟活跃人数。
get-goals.ts: 目标发现工具，调用 Sites goals API，为 get_conversions 提供 goal 名称入口。
get-timeseries.ts: 时间序列工具，按 day/week/month 维度查询趋势，并暴露 resolveSiteId。
get-breakdown.ts: 维度拆分工具，按 page/source/country/device/browser 等维度查询排行。
get-conversions.ts: 转化查询工具，按 goal/page 查询转化率和转化次数。
compare-periods.ts: 时间段对比工具，分别查询两个时间窗并计算绝对值与百分比差异。

法则: 每个工具只做输入 schema、参数组装、错误文案和 JSON 输出；API 差异统一收敛到 ../plausible.ts。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
