import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlausibleClient, PlausibleApiError } from "../src/plausible.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockError(status: number, body: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
}

function mockJsonResponse(status: number, data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe("PlausibleClient", () => {
  let client: PlausibleClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new PlausibleClient({
      apiKey: "test-key",
      baseUrl: "https://plausible.io",
    });
  });

  it("sends correct request to /api/v2/query", async () => {
    mockOk({ results: [], meta: {}, query: {} });

    await client.query({
      site_id: "example.com",
      metrics: ["visitors", "pageviews"],
      date_range: "30d",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://plausible.io/api/v2/query",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      site_id: "example.com",
      metrics: ["visitors", "pageviews"],
      date_range: "30d",
    });
  });

  it("includes dimensions when provided", async () => {
    mockOk({ results: [], meta: {}, query: {} });

    await client.query({
      site_id: "example.com",
      metrics: ["visitors"],
      date_range: "7d",
      dimensions: ["time:day"],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.dimensions).toEqual(["time:day"]);
  });

  it("passes single filter as array", async () => {
    mockOk({ results: [], meta: {}, query: {} });

    await client.query({
      site_id: "example.com",
      metrics: ["visitors"],
      date_range: "7d",
      filters: [["is", "event:page", ["/pricing"]]],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.filters).toEqual([["is", "event:page", ["/pricing"]]]);
  });

  it("passes multiple filters as array (implicit AND)", async () => {
    mockOk({ results: [], meta: {}, query: {} });

    await client.query({
      site_id: "example.com",
      metrics: ["visitors"],
      date_range: "7d",
      filters: [
        ["is", "event:page", ["/pricing"]],
        ["is", "event:goal", ["Signup"]],
      ],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.filters).toEqual([
      ["is", "event:page", ["/pricing"]],
      ["is", "event:goal", ["Signup"]],
    ]);
  });

  it("includes pagination when provided", async () => {
    mockOk({ results: [], meta: {}, query: {} });

    await client.query({
      site_id: "example.com",
      metrics: ["visitors"],
      date_range: "7d",
      pagination: { limit: 10, offset: 5 },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.pagination).toEqual({ limit: 10, offset: 5 });
  });

  it("uses self-hosted base URL", async () => {
    const selfHosted = new PlausibleClient({
      apiKey: "key",
      baseUrl: "https://analytics.mycompany.com/",
    });

    mockOk({ results: [], meta: {}, query: {} });

    await selfHosted.query({
      site_id: "example.com",
      metrics: ["visitors"],
      date_range: "7d",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://analytics.mycompany.com/api/v2/query",
      expect.anything()
    );
  });

  it("strips trailing slash from base URL", async () => {
    const trailing = new PlausibleClient({
      apiKey: "key",
      baseUrl: "https://plausible.io/",
    });

    mockOk({ results: [], meta: {}, query: {} });

    await trailing.query({
      site_id: "example.com",
      metrics: ["visitors"],
      date_range: "7d",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://plausible.io/api/v2/query",
      expect.anything()
    );
  });

  it("defaults base URL to plausible.io", async () => {
    const defaultClient = new PlausibleClient({ apiKey: "key" });

    mockOk({ results: [], meta: {}, query: {} });

    await defaultClient.query({
      site_id: "example.com",
      metrics: ["visitors"],
      date_range: "7d",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://plausible.io/api/v2/query",
      expect.anything()
    );
  });

  it("throws PlausibleApiError on 401", async () => {
    mockError(401, "Invalid API key");

    await expect(
      client.query({
        site_id: "example.com",
        metrics: ["visitors"],
        date_range: "7d",
      })
    ).rejects.toThrow(PlausibleApiError);

    try {
      mockError(401, "Invalid API key");
      await client.query({
        site_id: "example.com",
        metrics: ["visitors"],
        date_range: "7d",
      });
    } catch (e) {
      expect(e).toBeInstanceOf(PlausibleApiError);
      expect((e as PlausibleApiError).status).toBe(401);
    }
  });

  it("throws PlausibleApiError on 429 rate limit", async () => {
    mockError(429, "Rate limit exceeded");

    await expect(
      client.query({
        site_id: "example.com",
        metrics: ["visitors"],
        date_range: "7d",
      })
    ).rejects.toThrow(PlausibleApiError);
  });

  it("throws PlausibleApiError on 500", async () => {
    mockError(500, "Internal Server Error");

    await expect(
      client.query({
        site_id: "example.com",
        metrics: ["visitors"],
        date_range: "7d",
      })
    ).rejects.toThrow(PlausibleApiError);
  });

  it("returns parsed response on success", async () => {
    const data = {
      results: [{ dimensions: ["2024-01-01"], metrics: [100, 200] }],
      meta: { imports_included: false },
      query: { site_id: "example.com" },
    };
    mockOk(data);

    const result = await client.query({
      site_id: "example.com",
      metrics: ["visitors", "pageviews"],
      date_range: "7d",
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].metrics).toEqual([100, 200]);
  });

  it("lists sites through the Sites API", async () => {
    const data = {
      sites: [{ domain: "example.com", timezone: "Etc/UTC" }],
      meta: { limit: 100 },
    };
    mockOk(data);

    const result = await client.listSites(50);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "https://plausible.io/api/v1/sites?limit=50",
      }),
      { headers: { Authorization: "Bearer test-key" } }
    );
    expect(result.sites[0].domain).toBe("example.com");
  });

  it("lists goals through the Sites API", async () => {
    const data = {
      goals: [{ id: 1, display_name: "Signup", goal_type: "event" }],
      meta: {},
    };
    mockOk(data);

    const result = await client.listGoals("example.com", 20);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "https://plausible.io/api/v1/sites/goals?site_id=example.com&limit=20",
      }),
      { headers: { Authorization: "Bearer test-key" } }
    );
    expect(result.goals[0].display_name).toBe("Signup");
  });

  it("gets realtime visitors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("7"),
    });

    const result = await client.getRealtimeVisitors("example.com");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "https://plausible.io/api/v1/stats/realtime/visitors?site_id=example.com",
      }),
      { headers: { Authorization: "Bearer test-key" } }
    );
    expect(result).toBe(7);
  });

  it("falls back to v1 timeseries when v2 query is unavailable", async () => {
    mockJsonResponse(404, { error: "not found" });
    mockJsonResponse(200, {
      results: [
        { date: "2026-06-28", visitors: 11, pageviews: 13 },
        { date: "2026-06-29", visitors: 9, pageviews: 22 },
      ],
    });

    const result = await client.query({
      site_id: "example.com",
      metrics: ["visitors", "pageviews"],
      date_range: "7d",
      dimensions: ["time:day"],
    });

    const fallbackUrl = new URL(String(mockFetch.mock.calls[1][0]));
    expect(fallbackUrl.pathname).toBe("/api/v1/stats/timeseries");
    expect(fallbackUrl.searchParams.get("period")).toBe("7d");
    expect(result.results[0]).toEqual({
      dimensions: ["2026-06-28"],
      metrics: [11, 13],
    });
  });

  it("falls back to v1 breakdown and maps dimension rows", async () => {
    mockJsonResponse(404, { error: "not found" });
    mockJsonResponse(200, {
      results: [{ page: "/", visitors: 79, pageviews: 97, bounce_rate: 69 }],
    });

    const result = await client.query({
      site_id: "example.com",
      metrics: ["visitors", "pageviews", "bounce_rate"],
      date_range: "7d",
      dimensions: ["event:page"],
      pagination: { limit: 5 },
    });

    const fallbackUrl = new URL(String(mockFetch.mock.calls[1][0]));
    expect(fallbackUrl.pathname).toBe("/api/v1/stats/breakdown");
    expect(fallbackUrl.searchParams.get("property")).toBe("event:page");
    expect(fallbackUrl.searchParams.get("limit")).toBe("5");
    expect(result.results[0]).toEqual({
      dimensions: ["/"],
      metrics: [79, 97, 69],
    });
  });

  it("falls back to v1 aggregate and serializes filters", async () => {
    mockJsonResponse(404, { error: "not found" });
    mockJsonResponse(200, {
      results: {
        visitors: { value: 29 },
        pageviews: { value: 49 },
      },
    });

    const result = await client.query({
      site_id: "example.com",
      metrics: ["visitors", "pageviews"],
      date_range: "2026-06-23,2026-06-29",
      filters: [["is", "event:page", ["/zh"]]],
    });

    const fallbackUrl = new URL(String(mockFetch.mock.calls[1][0]));
    expect(fallbackUrl.pathname).toBe("/api/v1/stats/aggregate");
    expect(fallbackUrl.searchParams.get("period")).toBe("custom");
    expect(fallbackUrl.searchParams.get("date")).toBe("2026-06-23,2026-06-29");
    expect(fallbackUrl.searchParams.get("filters")).toBe("event:page==/zh");
    expect(result.results[0].metrics).toEqual([29, 49]);
  });
});
