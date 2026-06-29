/**
 * [INPUT]: 依赖 @modelcontextprotocol/sdk 的 WebStandardStreamableHTTPServerTransport，依赖 server.js 创建 Plausible MCP server
 * [OUTPUT]: 对外提供 Cloudflare Worker fetch handler，通过 Authorization Bearer 接收 Plausible API key
 * [POS]: src 的远程入口，和 index.ts 的 stdio 入口并列，负责 HTTP/CORS 与每请求 server 初始化
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";

interface Env {
  PLAUSIBLE_BASE_URL?: string;
  PLAUSIBLE_DEFAULT_SITE_ID?: string;
  PLAUSIBLE_SITE_IDS?: string;
}

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

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
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
