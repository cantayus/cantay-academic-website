import { authorizeContentWriter, ContentError, getLiveContent, MAX_SNAPSHOT_BYTES, saveLiveContent } from "@/lib/live-content";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function failure(error: unknown): Response {
  if (error instanceof ContentError) return Response.json({ error: error.code, message: error.message }, { status: error.status, headers });
  return Response.json({ error: "content_unavailable", message: "Content could not be updated. The last good content remains available." }, { status: 503, headers });
}

export async function GET(): Promise<Response> {
  try {
    return Response.json(await getLiveContent(), { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await authorizeContentWriter(request);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      throw new ContentError(415, "json_required", "Send an application/json snapshot.");
    }
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_SNAPSHOT_BYTES) throw new ContentError(413, "snapshot_too_large", "The snapshot is too large.");
    if (!request.body) throw new ContentError(400, "invalid_json", "A JSON body is required.");
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let body = "";
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_SNAPSHOT_BYTES) {
        await reader.cancel();
        throw new ContentError(413, "snapshot_too_large", "The snapshot is too large.");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    let input: unknown;
    try { input = JSON.parse(body); } catch { throw new ContentError(400, "invalid_json", "The snapshot must be valid JSON."); }
    const content = await saveLiveContent(input);
    return Response.json({ ok: true, revision: content.revision, lastSync: content.lastSync, researchCount: content.research.length }, { headers });
  } catch (error) {
    return failure(error);
  }
}
