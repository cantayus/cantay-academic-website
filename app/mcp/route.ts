import { env } from "cloudflare:workers";
import {
  ContentError,
  fetchCanonicalResume,
  getLiveContent,
  MAX_SNAPSHOT_BYTES,
  saveLiveContent,
} from "@/lib/live-content";

export const dynamic = "force-dynamic";

const PROTOCOL_VERSIONS = ["2026-07-28", "2025-06-18", "2025-03-26", "2024-11-05"];
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const MAX_REQUEST_BYTES = MAX_SNAPSHOT_BYTES + 64 * 1024;
type RpcId = string | number | null;
type JsonObject = Record<string, unknown>;

const emptyInput = { type: "object", properties: {}, additionalProperties: false };
const tools = [
  {
    name: "get_sync_status",
    description: "Read only the current revision, storage state, last résumé sync time and source checksum/file ID, bundled résumé baseline checksum, and research count. Does not return the profile, catalog, or stories. Compare with inspect_resume_source before fetching get_site_content. Owner access is required.",
    inputSchema: emptyInput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "get_site_content",
    description: "Read the complete current website profile, research catalog, revision, and last successful résumé sync. Owner access is required. Preserve this snapshot when preparing an update.",
    inputSchema: emptyInput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "inspect_resume_source",
    description: "Download the configured public Google Drive résumé and report its canonical URL, file ID, SHA-256 checksum, size, observation time, and available upstream version headers. Does not return PDF bytes or change website content. Owner access is required.",
    inputSchema: emptyInput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "update_resume_content",
    description: "Persist a complete, reconciled website snapshot from the current public résumé. Start with get_site_content, preserve existing fields and stable IDs, and use inspect_resume_source for source metadata. The server validates the snapshot, rechecks the source, requires the expected current revision, preserves reviewed research, and reads back the immutable R2 revision before atomically updating the current pointer. Owner access is required.",
    inputSchema: {
      type: "object",
      required: ["expectedRevision", "profile", "research", "source"],
      additionalProperties: false,
      properties: {
        expectedRevision: { type: "string", minLength: 1, maxLength: 200, description: "The exact revision returned by get_site_content." },
        profile: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 1 } }, additionalProperties: true, description: "The complete current profile, with only source-supported résumé changes. Preserve all existing fields, including headshot, games, education, appointments, invitedTalks, teaching, and editorialPreferences. Do not add grants or academic-service website sections; preserve the owner's exclusions." },
        research: {
          type: "array", minItems: 1, maxItems: 1000,
          description: "The reconciled complete research catalog. Preserve stable IDs, source links, publication categories, reviewed summaries and fullTextReviewed flags.",
          items: {
            type: "object",
            required: ["id", "title", "authors", "year", "status", "venue", "topics", "methods", "summary", "question", "findings", "links", "fullTextReviewed", "sourceBasis", "sourceUrls"],
            additionalProperties: true,
            properties: {
              id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
              title: { type: "string" }, authors: { type: "array", items: { type: "string" }, minItems: 1 },
              year: { type: ["integer", "null"] }, status: { type: "string" }, venue: { type: ["string", "null"] },
              topics: { type: "array", items: { type: "string" } }, methods: { type: "array", items: { type: "string" } },
              summary: { type: "string" }, question: { type: ["string", "null"] },
              findings: { type: "array", items: { type: "string" } },
              links: { type: "array", items: { type: "object", required: ["label", "url"], properties: { label: { type: "string" }, url: { type: "string" } }, additionalProperties: true } },
              fullTextReviewed: { type: "boolean" }, sourceBasis: { type: "string" }, sourceUrls: { type: "array", items: { type: "string" } },
            },
          },
        },
        source: {
          type: "object", required: ["kind", "fileId", "checksumSha256", "observedAt"], additionalProperties: false,
          properties: {
            kind: { type: "string", const: "google-drive" },
            fileId: { type: "string", pattern: "^[A-Za-z0-9_-]{10,200}$" },
            checksumSha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
            observedAt: { type: "string", format: "date-time", description: "The fresh fetchedAt timestamp returned by inspect_resume_source." },
            version: { type: "string", maxLength: 500, description: "Optional upstream version label. Never invent one." },
          },
        },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
];

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function rpcResult(id: RpcId, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: RESPONSE_HEADERS });
}

function rpcError(id: RpcId, code: number, message: string, status = 400, data?: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } }, { status, headers: RESPONSE_HEADERS });
}

function toolResult(value: unknown, isError = false): JsonObject {
  return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, isError };
}

function requireOwner(request: Request): void {
  const configured = (env as Cloudflare.Env & { SITE_OWNER_EMAIL?: string }).SITE_OWNER_EMAIL;
  const expected = typeof configured === "string" ? configured.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expected)) {
    throw new ContentError(503, "owner_not_configured", "Owner-authorized website updates are not configured.");
  }
  // Sites authenticates MCP calls and supplies this verified identity. Never
  // substitute a query parameter, JSON field, ordinary bearer token, or a
  // professional/public email address when the platform identity is absent.
  const actual = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!actual || actual !== expected) {
    throw new ContentError(403, "owner_required", "Only the configured website owner may call these tools.");
  }
}

async function readMessage(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ContentError(415, "json_required", "Send an application/json JSON-RPC request.");
  }
  if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_BYTES) {
    throw new ContentError(413, "request_too_large", "The JSON-RPC request is too large.");
  }
  if (!request.body) throw new ContentError(400, "invalid_json", "A JSON-RPC request body is required.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new ContentError(413, "request_too_large", "The JSON-RPC request is too large.");
    }
    body += decoder.decode(chunk.value, { stream: true });
  }
  body += decoder.decode();
  try { return JSON.parse(body); }
  catch { throw new ContentError(400, "invalid_json", "The JSON-RPC request must be valid JSON."); }
}

export async function POST(request: Request): Promise<Response> {
  let id: RpcId = null;
  try {
    const message = await readMessage(request);
    if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return rpcError(null, -32600, "Invalid JSON-RPC request.");
    }
    const hasId = Object.prototype.hasOwnProperty.call(message, "id");
    if (hasId && message.id !== null && typeof message.id !== "string" && !(typeof message.id === "number" && Number.isFinite(message.id))) {
      return rpcError(null, -32600, "Invalid JSON-RPC request ID.");
    }
    id = hasId ? message.id as RpcId : null;
    if (!hasId) {
      // Notifications never execute tools or persist data.
      if (message.method.startsWith("notifications/")) return new Response(null, { status: 204, headers: RESPONSE_HEADERS });
      return rpcError(null, -32600, "A request ID is required for this method.");
    }
    if (message.params !== undefined && !isObject(message.params)) return rpcError(id, -32602, "Method parameters must be an object.");
    const params = (message.params || {}) as JsonObject;
    switch (message.method) {
      case "server/discover":
        return rpcResult(id, { supportedVersions: PROTOCOL_VERSIONS, capabilities: { tools: {} }, serverInfo: { name: "cantay-academic-website", version: "1.0.0" } });
      case "initialize": {
        const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
          capabilities: { tools: {} },
          serverInfo: { name: "cantay-academic-website", version: "1.0.0" },
          instructions: "Website content tools are restricted to the configured owner. First compare get_sync_status with inspect_resume_source. Fetch the complete get_site_content snapshot only when the source changes or an update requires it. Preserve reviewed research and existing profile fields.",
        });
      }
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, { tools });
      case "tools/call": {
        requireOwner(request);
        if (typeof params.name !== "string") return rpcError(id, -32602, "A tool name is required.");
        const argumentsValue = params.arguments === undefined ? {} : params.arguments;
        if (!isObject(argumentsValue)) return rpcError(id, -32602, "Tool arguments must be an object.");
        try {
          switch (params.name) {
            case "get_sync_status": {
              if (Object.keys(argumentsValue).length) return rpcError(id, -32602, "This tool takes no arguments.");
              const content = await getLiveContent();
              const resume = content.profile.resume;
              const baselineSha256 = isObject(resume) && typeof resume.baselineSha256 === "string" ? resume.baselineSha256 : undefined;
              return rpcResult(id, toolResult({
                revision: content.revision,
                storage: content.storage,
                ...(content.lastSync ? { lastSync: {
                  at: content.lastSync.at,
                  source: {
                    checksumSha256: content.lastSync.source.checksumSha256,
                    fileId: content.lastSync.source.fileId,
                  },
                } } : {}),
                ...(baselineSha256 ? { profile: { resume: { baselineSha256 } } } : {}),
                researchCount: content.research.length,
              }));
            }
            case "get_site_content":
              if (Object.keys(argumentsValue).length) return rpcError(id, -32602, "This tool takes no arguments.");
              return rpcResult(id, toolResult(await getLiveContent()));
            case "inspect_resume_source": {
              if (Object.keys(argumentsValue).length) return rpcError(id, -32602, "This tool takes no arguments.");
              const source = await fetchCanonicalResume();
              return rpcResult(id, toolResult({
                sourceUrl: source.sourceUrl, fileId: source.fileId,
                checksumSha256: source.checksumSha256, byteLength: source.bytes.byteLength,
                fetchedAt: source.fetchedAt,
                ...(source.upstreamETag ? { upstreamETag: source.upstreamETag } : {}),
                ...(source.upstreamLastModified ? { upstreamLastModified: source.upstreamLastModified } : {}),
              }));
            }
            case "update_resume_content":
              return rpcResult(id, toolResult(await saveLiveContent(argumentsValue)));
            default:
              return rpcResult(id, toolResult({ error: "unknown_tool", message: "This tool is not available." }, true));
          }
        } catch (error) {
          const known = error instanceof ContentError;
          return rpcResult(id, toolResult({
            error: known ? error.code : "content_unavailable",
            message: known ? error.message : "The content operation could not complete. The last good website content remains available.",
            ...(known ? { status: error.status } : {}),
          }, true));
        }
      }
      default:
        return rpcError(id, -32601, "Method not found.", 404);
    }
  } catch (error) {
    const known = error instanceof ContentError;
    return rpcError(id, known && error.code === "invalid_json" ? -32700 : -32001,
      known ? error.message : "The content service is temporarily unavailable.",
      known ? error.status : 503,
      { error: known ? error.code : "content_unavailable" });
  }
}
