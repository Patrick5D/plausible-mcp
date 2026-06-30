/**
 * [INPUT]: 依赖 WebStandardStreamableHTTPServerTransport、server.js 和 IP 限流状态
 * [OUTPUT]: 对外提供 Cloudflare Worker fetch handler，通过 Authorization Bearer 接收 Plausible API key
 * [POS]: src 的远程入口，和 index.ts 的 stdio 入口并列，负责 HTTP/CORS、限流与每请求 server 初始化
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  PLAUSIBLE_BASE_URL?: string;
  PLAUSIBLE_DEFAULT_SITE_ID?: string;
  PLAUSIBLE_SITE_IDS?: string;
  MCP_RATE_LIMIT_PER_MINUTE?: string;
  RATE_LIMITER?: RateLimiter;
}

interface LocalBucket {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT = 60;
const MAX_LOCAL_BUCKETS = 1_000;
const localBuckets = new Map<string, LocalBucket>();

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function corsResponse(response: Response): Response {
  const patched = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    patched.headers.set(key, value);
  }
  return patched;
}

function rateLimitResponse(): Response {
  return corsResponse(
    new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    })
  );
}

function configuredLimit(env: Env): number {
  const parsed = Number(env.MCP_RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_RATE_LIMIT;
}

function allowLocalRequest(key: string, limit: number, now: number): boolean {
  pruneLocalBuckets(now);

  const current = localBuckets.get(key);
  if (!current || current.resetAt <= now) {
    localBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function pruneLocalBuckets(now: number): void {
  if (localBuckets.size === 0) return;

  for (const [key, bucket] of localBuckets) {
    if (bucket.resetAt <= now) localBuckets.delete(key);
  }

  while (localBuckets.size > MAX_LOCAL_BUCKETS) {
    const oldestKey = localBuckets.keys().next().value;
    if (!oldestKey) return;
    localBuckets.delete(oldestKey);
  }
}

async function isRateLimited(request: Request, env: Env): Promise<boolean> {
  const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (env.RATE_LIMITER) {
    const result = await env.RATE_LIMITER.limit({ key });
    return !result.success;
  }

  return !allowLocalRequest(key, configuredLimit(env), Date.now());
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (await isRateLimited(request, env)) {
      return rateLimitResponse();
    }

    const authHeader = request.headers.get("Authorization");
    const apiKey = authHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!apiKey) {
      return corsResponse(
        new Response(
          JSON.stringify({
            error:
              "Missing Plausible API key. Pass it as a Bearer token in the Authorization header.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      );
    }

    if (apiKey.length < 8) {
      return corsResponse(
        new Response(
          JSON.stringify({
            error: "Invalid API key. Key is too short.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      );
    }

    try {
      const server = createServer({
        apiKey,
        baseUrl: env.PLAUSIBLE_BASE_URL,
        defaultSiteId: env.PLAUSIBLE_DEFAULT_SITE_ID,
        siteIds: env.PLAUSIBLE_SITE_IDS?.split(",")
          .map((site) => site.trim())
          .filter(Boolean),
      });
      const transport = new WebStandardStreamableHTTPServerTransport();
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      return corsResponse(response);
    } catch {
      return corsResponse(
        new Response(JSON.stringify({ error: "Server configuration error." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
  },
} satisfies ExportedHandler<Env>;
