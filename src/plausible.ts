/**
 * [INPUT]: 依赖全局 fetch 调用 Plausible Stats API v2，并在 404 时兼容旧版 v1 stats endpoints
 * [OUTPUT]: 对外提供 PlausibleClient、PlausibleApiError、query 参数与统一响应类型
 * [POS]: src 的 API 边界层，被 server.ts 创建后供所有 tools 消费，隐藏自托管 Plausible 版本差异
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export interface PlausibleQueryParams {
  site_id: string;
  metrics: string[];
  date_range: string;
  dimensions?: string[];
  filters?: unknown[];
  pagination?: { limit: number; offset?: number };
}

export interface PlausibleResult {
  dimensions: (string | number)[];
  metrics: (number | null)[];
}

export interface PlausibleResponse {
  results: PlausibleResult[];
  meta: Record<string, unknown>;
  query: Record<string, unknown>;
}

export interface PlausibleSite {
  domain: string;
  timezone?: string;
}

export interface PlausibleSitesResponse {
  sites: PlausibleSite[];
  meta?: Record<string, unknown>;
}

export interface PlausibleGoal {
  id: string | number;
  goal_type?: string;
  display_name?: string;
  event_name?: string | null;
  page_path?: string | null;
  custom_props?: Record<string, unknown>;
}

export interface PlausibleGoalsResponse {
  goals: PlausibleGoal[];
  meta?: Record<string, unknown>;
}

export class PlausibleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Plausible API error ${status}: ${body}`);
    this.name = "PlausibleApiError";
  }
}

interface V1AggregateResponse {
  results: Record<string, { value: number | null }>;
}

interface V1RowsResponse {
  results: Array<Record<string, string | number | null>>;
}

export interface PlausibleClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class PlausibleClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: PlausibleClientConfig) {
    this.apiKey = config.apiKey;
    const raw = (config.baseUrl ?? "https://plausible.io").replace(/\/$/, "");
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("baseUrl must use HTTPS (or HTTP for localhost)");
    }
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new Error("baseUrl must use HTTPS");
    }
    this.baseUrl = raw;
  }

  async query(params: PlausibleQueryParams): Promise<PlausibleResponse> {
    const response = await this.queryV2(params);
    if (response.status !== 404) {
      return this.readJsonResponse(response);
    }

    return this.queryV1(params);
  }

  async listSites(limit = 100): Promise<PlausibleSitesResponse> {
    const url = new URL(`${this.baseUrl}/api/v1/sites`);
    url.searchParams.set("limit", String(limit));

    return this.getJson(url) as Promise<PlausibleSitesResponse>;
  }

  async listGoals(siteId: string, limit = 100): Promise<PlausibleGoalsResponse> {
    const url = new URL(`${this.baseUrl}/api/v1/sites/goals`);
    url.searchParams.set("site_id", siteId);
    url.searchParams.set("limit", String(limit));

    return this.getJson(url) as Promise<PlausibleGoalsResponse>;
  }

  async getRealtimeVisitors(siteId: string): Promise<number> {
    const url = new URL(`${this.baseUrl}/api/v1/stats/realtime/visitors`);
    url.searchParams.set("site_id", siteId);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new PlausibleApiError(response.status, text);
    }

    const text = await response.text();
    const value = Number(text);
    if (!Number.isFinite(value)) {
      throw new PlausibleApiError(response.status, `Invalid realtime response: ${text}`);
    }

    return value;
  }

  private async getJson(url: URL): Promise<unknown> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new PlausibleApiError(response.status, text);
    }

    return response.json();
  }

  private async queryV2(params: PlausibleQueryParams): Promise<Response> {
    const url = `${this.baseUrl}/api/v2/query`;

    const body: Record<string, unknown> = {
      site_id: params.site_id,
      metrics: params.metrics,
      date_range: params.date_range,
    };

    if (params.dimensions?.length) {
      body.dimensions = params.dimensions;
    }

    if (params.filters?.length) {
      body.filters = params.filters;
    }

    if (params.pagination) {
      body.pagination = params.pagination;
    }

    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  private async readJsonResponse(response: Response): Promise<PlausibleResponse> {
    if (!response.ok) {
      const text = await response.text();
      throw new PlausibleApiError(response.status, text);
    }

    return (await response.json()) as PlausibleResponse;
  }

  private async queryV1(params: PlausibleQueryParams): Promise<PlausibleResponse> {
    const dimension = params.dimensions?.[0];
    const endpoint = this.v1Endpoint(dimension);
    const url = new URL(`${this.baseUrl}/api/v1/stats/${endpoint}`);

    url.searchParams.set("site_id", params.site_id);
    this.setV1DateRange(url, params.date_range);
    url.searchParams.set("metrics", params.metrics.join(","));

    if (endpoint === "breakdown" && dimension) {
      url.searchParams.set("property", dimension);
      url.searchParams.set("limit", String(params.pagination?.limit ?? 100));
    }

    const filters = this.v1Filters(params.filters);
    if (filters) {
      url.searchParams.set("filters", filters);
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new PlausibleApiError(response.status, text);
    }

    const data = (await response.json()) as V1AggregateResponse | V1RowsResponse;
    return this.v1ToV2LikeResponse(params, endpoint, dimension, data);
  }

  private v1Endpoint(dimension: string | undefined): "aggregate" | "breakdown" | "timeseries" {
    if (!dimension) return "aggregate";
    if (dimension.startsWith("time:")) return "timeseries";
    return "breakdown";
  }

  private setV1DateRange(url: URL, dateRange: string): void {
    if (dateRange.includes(",")) {
      url.searchParams.set("period", "custom");
      url.searchParams.set("date", dateRange);
      return;
    }
    url.searchParams.set("period", dateRange);
  }

  private v1Filters(filters: unknown[] | undefined): string | undefined {
    if (!filters?.length) return undefined;

    const parts = filters
      .map((filter) => {
        if (!Array.isArray(filter)) return undefined;
        const [op, property, values] = filter;
        if (typeof op !== "string" || typeof property !== "string") return undefined;
        if (!Array.isArray(values) || typeof values[0] !== "string") return undefined;

        const suffix = op === "contains" ? "*" : "";
        return `${property}==${values[0]}${suffix}`;
      })
      .filter((part): part is string => Boolean(part));

    return parts.length ? parts.join(";") : undefined;
  }

  private v1ToV2LikeResponse(
    params: PlausibleQueryParams,
    endpoint: "aggregate" | "breakdown" | "timeseries",
    dimension: string | undefined,
    data: V1AggregateResponse | V1RowsResponse
  ): PlausibleResponse {
    if (endpoint === "aggregate") {
      const aggregate = data as V1AggregateResponse;
      return {
        results: [
          {
            dimensions: [],
            metrics: params.metrics.map((metric) => aggregate.results[metric]?.value ?? null),
          },
        ],
        meta: { api_version: "v1" },
        query: { ...params },
      };
    }

    const rows = (data as V1RowsResponse).results;
    const dimensionKey = endpoint === "timeseries" ? "date" : this.v1DimensionKey(dimension);

    return {
      results: rows.map((row) => ({
        dimensions: [this.v1DimensionValue(row[dimensionKey])],
        metrics: params.metrics.map((metric) => this.v1MetricValue(row[metric])),
      })),
      meta: { api_version: "v1" },
      query: { ...params },
    };
  }

  private v1DimensionKey(dimension: string | undefined): string {
    if (!dimension) return "";
    return dimension.slice(dimension.indexOf(":") + 1);
  }

  private v1DimensionValue(value: string | number | null | undefined): string | number {
    return typeof value === "string" || typeof value === "number" ? value : "";
  }

  private v1MetricValue(value: string | number | null | undefined): number | null {
    return typeof value === "number" ? value : null;
  }
}
