import { describe, it, expect } from "vitest";
import worker from "../src/worker.js";

function request(headers?: Record<string, string>) {
  return new Request("https://worker.example.com/mcp", {
    method: "POST",
    headers,
  });
}

describe("Cloudflare Worker entrypoint", () => {
  it("handles CORS preflight", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example.com/mcp", { method: "OPTIONS" }),
      {},
      {} as ExecutionContext
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 401 when Authorization is missing", async () => {
    const response = await worker.fetch(
      request({ "CF-Connecting-IP": "203.0.113.10" }),
      {},
      {} as ExecutionContext
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Missing Plausible API key");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rate limits before authentication", async () => {
    const env = { MCP_RATE_LIMIT_PER_MINUTE: "1" };
    const headers = { "CF-Connecting-IP": "203.0.113.11" };

    const first = await worker.fetch(request(headers), env, {} as ExecutionContext);
    const second = await worker.fetch(request(headers), env, {} as ExecutionContext);

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBe("60");
  });

  it("uses Cloudflare RATE_LIMITER binding when present", async () => {
    const response = await worker.fetch(
      request({ "CF-Connecting-IP": "203.0.113.12" }),
      {
        RATE_LIMITER: {
          limit: async () => ({ success: false }),
        },
      },
      {} as ExecutionContext
    );

    expect(response.status).toBe(429);
  });
});
