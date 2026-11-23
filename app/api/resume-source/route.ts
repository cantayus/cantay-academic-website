import { ContentError, fetchCanonicalResume } from "@/lib/live-content";

export const dynamic = "force-dynamic";

async function sourceResponse(headOnly: boolean): Promise<Response> {
  try {
    const source = await fetchCanonicalResume();
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Cantay-Caliskan-CV.pdf"',
      "Content-Length": String(source.bytes.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Resume-SHA256": source.checksumSha256,
      "X-Resume-File-Id": source.fileId,
      "X-Resume-Source-Url": source.sourceUrl,
      "X-Resume-Fetched-At": source.fetchedAt,
    });
    if (source.upstreamETag) headers.set("X-Resume-Source-ETag", source.upstreamETag);
    if (source.upstreamLastModified) headers.set("X-Resume-Source-Last-Modified", source.upstreamLastModified);
    return new Response(headOnly ? null : source.bytes as BodyInit, { headers });
  } catch (error) {
    const known = error instanceof ContentError;
    return Response.json({ error: known ? error.code : "resume_unavailable", message: known ? error.message : "The résumé source is temporarily unavailable." }, {
      status: known ? error.status : 502,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
}

export async function GET(): Promise<Response> { return sourceResponse(false); }
export async function HEAD(): Promise<Response> { return sourceResponse(true); }
