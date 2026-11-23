import { env } from "cloudflare:workers";
import { z } from "zod";
import baselineProfile from "../content/profile.json";
import baselineResearch from "../content/research.json";

const POINTER_KEY = "content/current.json";
const REVISION_PREFIX = "content/revisions/";
export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const MAX_RESUME_BYTES = 20 * 1024 * 1024;
const DEFAULT_DRIVE_ID = "1BrqPNXyQPgYKTzKbj5nD-EmhQlvbMIeq";

type SyncEnvironment = Cloudflare.Env & {
  CONTENT_SYNC_TOKEN?: string;
  RESUME_DRIVE_FILE_ID?: string;
};

const text = z.string().trim().min(1).max(20_000);
const stableId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160);
const safeUrl = z.string().max(2_000).refine((value) => {
  if (/[\u0000-\u0020\\]/.test(value)) return false;
  try {
    if (value.startsWith("/") && !value.startsWith("//")) return new URL(value, "https://site.invalid").origin === "https://site.invalid";
    const parsed = new URL(value);
    return ["https:", "mailto:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}, "Use an HTTPS, mailto, or same-site relative URL");

// Passthrough keeps reviewed bibliographic fields that are not rendered today.
const researchRecord = z.object({
  id: stableId,
  title: text,
  authors: z.array(text).min(1).max(100),
  year: z.number().int().min(1900).max(2200).nullable(),
  status: text,
  venue: z.string().max(2_000).nullable(),
  topics: z.array(text).max(40),
  methods: z.array(text).max(40),
  summary: text,
  question: z.string().max(20_000).nullable(),
  findings: z.array(text).max(40),
  links: z.array(z.object({ label: text, url: safeUrl }).passthrough()).max(50),
  fullTextReviewed: z.boolean(),
  sourceBasis: text,
  sourceUrls: z.array(safeUrl).max(50),
}).passthrough();

const profileRecord = z.object({ name: text }).passthrough();
const sourceRecord = z.object({
  kind: z.literal("google-drive"),
  fileId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  observedAt: z.string().datetime({ offset: true }),
  // This is an upstream version label, when the source exposes one. The server
  // records its own download timestamp, checksum and upstream headers as well.
  version: z.string().max(500).optional(),
}).strict();

const snapshotRequest = z.object({
  expectedRevision: z.string().min(1).max(200),
  profile: profileRecord,
  research: z.array(researchRecord).min(1).max(1_000),
  source: sourceRecord,
}).strict();

export type ResearchRecord = z.infer<typeof researchRecord>;
export type ProfileRecord = z.infer<typeof profileRecord>;
export type LastSync = {
  status: "success";
  at: string;
  contentChecksumSha256: string;
  source: z.infer<typeof sourceRecord> & {
    fetchedAt: string;
    byteLength: number;
    upstreamETag?: string;
    upstreamLastModified?: string;
  };
};
export type LiveContent = {
  profile: ProfileRecord;
  research: ResearchRecord[];
  revision: string;
  lastSync?: LastSync;
  storage: "baseline" | "live" | "previous-good";
};
type BundledSnapshot = {
  revision: string;
  profile: ProfileRecord;
  research: ResearchRecord[];
};
type StoredSnapshot = {
  schemaVersion: 1 | 2;
  // v2 records the source against which automatic changes were made. This is
  // bounded by the same total serialized revision limit as the live content.
  baseline?: BundledSnapshot;
  revision: string;
  profile: ProfileRecord;
  research: ResearchRecord[];
  lastSync: LastSync;
};
type Pointer = { revision: string; previousRevision?: string };

export class ContentError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ContentError";
  }
}

function runtime(): SyncEnvironment {
  return env as SyncEnvironment;
}

function assertPlainJson(value: unknown, depth = 0, count = { nodes: 0 }): void {
  if (++count.nodes > 100_000 || depth > 16) {
    throw new ContentError(400, "invalid_snapshot", "The snapshot is too deeply nested or large.");
  }
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value === "string" && value.length <= 100_000) return;
  if (Array.isArray(value)) {
    if (value.length > 5_000) throw new ContentError(400, "invalid_snapshot", "An array is too large.");
    for (const item of value) assertPlainJson(item, depth + 1, count);
    return;
  }
  if (typeof value === "object" && value && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) {
        throw new ContentError(400, "invalid_snapshot", "Unsafe object key.");
      }
      // Validate URLs in extra profile/bibliographic fields too.
      if (typeof item === "string" && /(?:url|href)$/i.test(key) && !safeUrl.safeParse(item).success) {
        throw new ContentError(400, "invalid_snapshot", `Invalid URL in ${key}.`);
      }
      assertPlainJson(item, depth + 1, count);
    }
    return;
  }
  throw new ContentError(400, "invalid_snapshot", "Only finite, plain JSON values are supported.");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256(value: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mergeResearch(existing: ResearchRecord[], incoming: ResearchRecord[]): ResearchRecord[] {
  const entries = new Map(existing.map((item) => [item.id, item]));
  const seen = new Set<string>();
  for (const item of incoming) {
    if (seen.has(item.id)) throw new ContentError(400, "duplicate_id", `Research ID ${item.id} occurs twice.`);
    seen.add(item.id);
    const prior = entries.get(item.id);
    const normalized = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
    const titles = (record: ResearchRecord) => [record.title, ...(Array.isArray(record.formerTitles) ? record.formerTitles.filter((value): value is string => typeof value === "string") : [])].map(normalized);
    const ids = (record: ResearchRecord) => [record.id, ...(Array.isArray(record.legacyIds) ? record.legacyIds.filter((value): value is string => typeof value === "string") : [])];
    if (Array.from(entries.values()).some((record) => record.id !== item.id && (
      titles(record).some((title) => titles(item).includes(title))
      || ids(record).some((id) => ids(item).includes(id))
      || (typeof record.doi === "string" && typeof item.doi === "string" && normalized(record.doi) === normalized(item.doi))
      || (record.ssrnId != null && item.ssrnId != null && String(record.ssrnId) === String(item.ssrnId))
    ))) {
      throw new ContentError(400, "unstable_id", "A research title, former title, legacy ID, DOI, or SSRN identifier already belongs to another ID. Reconcile the existing canonical ID instead of duplicating it.");
    }
    if (!prior) {
      entries.set(item.id, item);
    } else {
      const merged = {
        ...prior, ...item,
        links: Array.from(new Map([...prior.links, ...item.links].map((link) => [link.url, link])).values()),
        sourceUrls: Array.from(new Set([...prior.sourceUrls, ...item.sourceUrls])),
      };
      // A CV listing can update bibliography, but cannot erase conclusions that
      // were grounded in a reviewed full manuscript.
      if (prior.fullTextReviewed && !item.fullTextReviewed) {
        Object.assign(merged, {
          summary: prior.summary, question: prior.question, findings: prior.findings,
          methods: prior.methods, fullTextReviewed: true, sourceBasis: prior.sourceBasis,
          ...(prior.stories ? {stories: prior.stories} : {}),
        });
      }
      entries.set(item.id, merged);
    }
  }
  return Array.from(entries.values());
}

// Omitted objects/fields survive. ID-bearing profile arrays are merged by ID;
// unkeyed arrays are complete fields and the new array replaces that field.
function mergeProfile(base: Record<string, unknown>, next: Record<string, unknown>): ProfileRecord {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(next)) {
    const before = merged[key];
    if (value && before && !Array.isArray(value) && !Array.isArray(before) && typeof value === "object" && typeof before === "object") {
      merged[key] = mergeProfile(before as Record<string, unknown>, value as Record<string, unknown>);
    } else if (Array.isArray(value) && Array.isArray(before) && [...before, ...value].every((entry) => entry && typeof entry === "object" && typeof entry.id === "string")) {
      const byId = new Map(before.map((entry) => [entry.id, entry]));
      for (const entry of value) {
        const prior = byId.get(entry.id);
        byId.set(entry.id, prior ? mergeProfile(prior, entry) : entry);
      }
      merged[key] = Array.from(byId.values());
    } else {
      merged[key] = value;
    }
  }
  return merged as ProfileRecord;
}

function validateProfileShape(reference: Record<string, unknown>, candidate: ProfileRecord): void {
  for (const key of Object.keys(reference)) {
    if (!(key in candidate)) throw new ContentError(400, "incomplete_profile", `Include the complete profile field ${key}. Start from GET /api/content.`);
  }
  function check(before: unknown, after: unknown, path: string): void {
    if (before === null || before === undefined) return;
    if (Array.isArray(before)) {
      if (!Array.isArray(after)) throw new ContentError(400, "invalid_profile", `${path} must be an array.`);
      const objectItems = before.length > 0 && before.every((entry) => entry && !Array.isArray(entry) && typeof entry === "object");
      const keyed = objectItems && before.every((entry) => typeof entry.id === "string");
      const commonKeys = objectItems ? Object.keys(before[0]).filter((key) => before.every((entry) => key in entry)) : [];
      for (const entry of after) {
        if (keyed && (!entry || typeof entry !== "object" || !stableId.safeParse(entry.id).success)) {
          throw new ContentError(400, "invalid_profile", `${path} entries must retain their stable IDs.`);
        }
        const prior = keyed ? before.find((item) => item.id === entry.id) : undefined;
        if (objectItems && !prior) {
          if (!entry || Array.isArray(entry) || typeof entry !== "object") throw new ContentError(400, "invalid_profile", `${path} entries must be objects.`);
          for (const key of commonKeys) if (!(key in entry)) throw new ContentError(400, "incomplete_profile", `${path} entries require ${key}.`);
        }
        if (before.length) check(prior || before[0], entry, `${path}[]`);
      }
      if (keyed) {
        const ids = after.map((entry) => entry.id);
        if (new Set(ids).size !== ids.length) throw new ContentError(400, "duplicate_id", `${path} contains a duplicate stable ID.`);
      }
      return;
    }
    if (typeof before === "object") {
      if (!after || Array.isArray(after) || typeof after !== "object") throw new ContentError(400, "invalid_profile", `${path} must be an object.`);
      // Optional nested fields may be omitted and survive the deep merge.
      for (const [key, value] of Object.entries(after)) if (key in before) check((before as Record<string, unknown>)[key], value, `${path}.${key}`);
      return;
    }
    if (typeof before !== typeof after) throw new ContentError(400, "invalid_profile", `${path} must be a ${typeof before}.`);
  }
  for (const key of Object.keys(reference)) check(reference[key], candidate[key], `profile.${key}`);
}

async function getBaseline(): Promise<LiveContent> {
  const profile = profileRecord.parse(baselineProfile);
  const research = z.array(researchRecord).parse(baselineResearch);
  const checksum = await sha256(canonicalJson({ profile, research }));
  return { profile, research, revision: `baseline-${checksum}`, storage: "baseline" };
}

async function readPointer(bucket: R2Bucket): Promise<{ pointer?: Pointer; etag?: string }> {
  const object = await bucket.get(POINTER_KEY);
  if (!object) return {};
  const value = await object.json<Pointer>();
  if (!/^[a-z0-9-]{1,100}$/.test(value.revision)) throw new Error("Invalid content pointer");
  if (value.previousRevision && !/^[a-z0-9-]{1,100}$/.test(value.previousRevision)) throw new Error("Invalid previous content pointer");
  return { pointer: value, etag: object.etag };
}

async function readRevision(bucket: R2Bucket, revision: string): Promise<StoredSnapshot> {
  const object = await bucket.get(`${REVISION_PREFIX}${revision}.json`);
  if (!object || object.size > MAX_SNAPSHOT_BYTES) throw new Error("Content revision missing or oversized");
  const stored = await object.json<StoredSnapshot>();
  assertPlainJson(stored);
  if (![1, 2].includes(stored.schemaVersion) || stored.revision !== revision || stored.lastSync?.status !== "success") throw new Error("Invalid content revision");
  if (stored.schemaVersion === 2) {
    if (!stored.baseline) throw new Error("Content baseline missing");
    profileRecord.parse(stored.baseline.profile);
    z.array(researchRecord).parse(stored.baseline.research);
    const baseHash = await sha256(canonicalJson({ profile: stored.baseline.profile, research: stored.baseline.research }));
    if (stored.baseline.revision !== `baseline-${baseHash}`) throw new Error("Content baseline checksum mismatch");
  } else if (stored.baseline) {
    throw new Error("Unexpected legacy baseline");
  }
  profileRecord.parse(stored.profile);
  z.array(researchRecord).parse(stored.research);
  const { kind, fileId, checksumSha256, observedAt, version } = stored.lastSync.source;
  sourceRecord.parse({ kind, fileId, checksumSha256, observedAt, ...(version ? { version } : {}) });
  const checksum = await sha256(canonicalJson({ profile: stored.profile, research: stored.research }));
  if (checksum !== stored.lastSync.contentChecksumSha256) throw new Error("Content checksum mismatch");
  return stored;
}

const MISSING = Symbol("missing JSON field");
type MergeValue = unknown | typeof MISSING;

function sameJson(left: MergeValue, right: MergeValue): boolean {
  if (left === MISSING || right === MISSING) return left === right;
  return canonicalJson(left) === canonicalJson(right);
}

function isJsonObject(value: MergeValue): value is Record<string, unknown> {
  return value !== MISSING && value !== null && typeof value === "object" && !Array.isArray(value);
}

function keyedArray(value: unknown[]): value is Array<Record<string, unknown> & { id: string }> {
  return value.every((entry) => isJsonObject(entry) && typeof entry.id === "string")
    && new Set(value.map((entry) => (entry as { id: string }).id)).size === value.length;
}

// Source edits win only where the bundled source changed. Unchanged fields
// retain live updates. A missing source field/ID is a deliberate deletion;
// entries added only by the live updater survive a later source deployment.
function reconcileValue(before: MergeValue, source: MergeValue, live: MergeValue): MergeValue {
  if (sameJson(before, source)) return live;
  if (source === MISSING) return MISSING;
  if (isJsonObject(source) && isJsonObject(live) && (before === MISSING || isJsonObject(before))) {
    const old = before === MISSING ? {} : before;
    const merged: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(old), ...Object.keys(source), ...Object.keys(live)])) {
      const value = reconcileValue(
        Object.hasOwn(old, key) ? old[key] : MISSING,
        Object.hasOwn(source, key) ? source[key] : MISSING,
        Object.hasOwn(live, key) ? live[key] : MISSING,
      );
      if (value !== MISSING) merged[key] = value;
    }
    return merged;
  }
  if (Array.isArray(source) && Array.isArray(live) && (before === MISSING || Array.isArray(before))) {
    const old = before === MISSING ? [] : before;
    if (keyedArray(old) && keyedArray(source) && keyedArray(live)) {
      const oldById = new Map(old.map((entry) => [entry.id, entry]));
      const sourceById = new Map(source.map((entry) => [entry.id, entry]));
      const liveById = new Map(live.map((entry) => [entry.id, entry]));
      const merged = [];
      for (const id of new Set([...sourceById.keys(), ...liveById.keys()])) {
        const value = reconcileValue(oldById.get(id) ?? MISSING, sourceById.get(id) ?? MISSING, liveById.get(id) ?? MISSING);
        if (value !== MISSING) merged.push(value);
      }
      return merged;
    }
  }
  // Scalars, unkeyed arrays and conflicting type changes are complete source
  // fields. Source wins the conflict; we never guess at a text/list merge.
  return source;
}

function withBaseline(baseline: LiveContent, stored: StoredSnapshot, storage: LiveContent["storage"]): LiveContent {
  const source = { profile: baseline.profile, research: baseline.research };
  const live = { profile: stored.profile, research: stored.research };
  // Legacy revisions have no reliable ancestor. Empty base conservatively
  // favors current source on shared fields, while retaining live-only additions.
  const before = stored.baseline ? { profile: stored.baseline.profile, research: stored.baseline.research } : {};
  const merged = reconcileValue(before, source, live) as typeof source;
  return {
    ...merged,
    // A deployment that changes the effective content also invalidates a writer
    // holding the old revision, even though the R2 pointer itself is unchanged.
    revision: stored.baseline?.revision === baseline.revision ? stored.revision : `${stored.revision}-${baseline.revision}`,
    lastSync: stored.lastSync,
    storage,
  };
}

export async function getLiveContent(): Promise<LiveContent> {
  const baseline = await getBaseline();
  const bucket = runtime().BUCKET;
  if (!bucket) return baseline;
  try {
    const { pointer } = await readPointer(bucket);
    if (!pointer) return baseline;
    try {
      return withBaseline(baseline, await readRevision(bucket, pointer.revision), "live");
    } catch {
      if (pointer.previousRevision) {
        return withBaseline(baseline, await readRevision(bucket, pointer.previousRevision), "previous-good");
      }
    }
  } catch {
    // A bad download, malformed object or storage outage cannot replace reviewed
    // source content. No partial snapshot is exposed to visitors.
  }
  return baseline;
}

export async function authorizeContentWriter(request: Request): Promise<void> {
  const expected = runtime().CONTENT_SYNC_TOKEN;
  if (!expected || expected.length < 32) {
    throw new ContentError(503, "writer_not_configured", "Content updates are not configured.");
  }
  const supplied = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") || "")?.[1] || "";
  const [left, right] = await Promise.all([sha256(expected), sha256(supplied)]);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  if (difference) throw new ContentError(401, "unauthorized", "A valid content-update credential is required.");
}

export function canonicalResumeFileId(): string {
  const id = runtime().RESUME_DRIVE_FILE_ID || DEFAULT_DRIVE_ID;
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new ContentError(503, "invalid_source_configuration", "The résumé source is not configured correctly.");
  return id;
}

export async function fetchCanonicalResume(): Promise<{
  bytes: Uint8Array;
  fileId: string;
  sourceUrl: string;
  checksumSha256: string;
  fetchedAt: string;
  upstreamETag?: string;
  upstreamLastModified?: string;
}> {
  const fileId = canonicalResumeFileId();
  const sourceUrl = `https://drive.google.com/file/d/${fileId}/view`;
  let response: Response;
  try {
    response = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`, {
      redirect: "follow",
      headers: { Accept: "application/pdf" },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new ContentError(502, "resume_unavailable", "The résumé source could not be downloaded.");
  }
  if (!response.ok || /text\/html|application\/json/i.test(response.headers.get("content-type") || "")) {
    await response.body?.cancel();
    throw new ContentError(502, "resume_not_pdf", "The résumé source returned an error or sign-in page instead of a public PDF.");
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_RESUME_BYTES || !response.body) {
    await response.body?.cancel();
    throw new ContentError(502, "resume_too_large", "The résumé source is empty or exceeds the download limit.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_RESUME_BYTES) {
      await reader.cancel();
      throw new ContentError(502, "resume_too_large", "The résumé source exceeds the download limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const beginning = new TextDecoder("ascii").decode(bytes.subarray(0, 1_024));
  if (!beginning.includes("%PDF-") || /<!doctype\s+html|<html/i.test(beginning)) {
    throw new ContentError(502, "resume_not_pdf", "The résumé source did not return a valid PDF header.");
  }
  return {
    bytes, fileId, sourceUrl,
    checksumSha256: await sha256(bytes),
    fetchedAt: new Date().toISOString(),
    upstreamETag: response.headers.get("etag") || undefined,
    upstreamLastModified: response.headers.get("last-modified") || undefined,
  };
}

export async function saveLiveContent(input: unknown): Promise<LiveContent> {
  assertPlainJson(input);
  const parsed = snapshotRequest.safeParse(input);
  if (!parsed.success) {
    throw new ContentError(400, "invalid_snapshot", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).slice(0, 8).join("; "));
  }
  const request = parsed.data;
  const bucket = runtime().BUCKET;
  if (!bucket) throw new ContentError(503, "storage_not_configured", "Persistent content storage is not configured.");
  const baseline = await getBaseline();
  const { pointer, etag } = await readPointer(bucket);
  let current = baseline;
  if (pointer) {
    // Do not overwrite a broken live revision silently. Visitors retain a good
    // fallback, while the updater gets an actionable error for owner repair.
    try {
      current = withBaseline(baseline, await readRevision(bucket, pointer.revision), "live");
    } catch {
      throw new ContentError(409, "live_revision_needs_recovery", "The live revision failed verification. The last good content is still served; inspect storage before updating.");
    }
  }
  if (request.expectedRevision !== current.revision) {
    throw new ContentError(409, "revision_conflict", "Content changed since it was read. Fetch the latest snapshot, reconcile it, and retry.");
  }
  validateProfileShape(current.profile, request.profile);
  if (request.profile.name !== current.profile.name) {
    throw new ContentError(400, "profile_identity_changed", "The résumé updater cannot change the profile owner.");
  }
  const observedAt = Date.parse(request.source.observedAt);
  if (observedAt > Date.now() + 5 * 60_000 || observedAt < Date.now() - 24 * 60 * 60_000) {
    throw new ContentError(400, "stale_source_observation", "Use a résumé observation from the past 24 hours.");
  }
  const downloaded = await fetchCanonicalResume();
  if (request.source.fileId !== downloaded.fileId || request.source.checksumSha256 !== downloaded.checksumSha256) {
    throw new ContentError(409, "source_changed", "The submitted facts do not match the current résumé version. Download and reconcile the current PDF first.");
  }
  const profile = mergeProfile(current.profile, request.profile);
  const research = mergeResearch(current.research, request.research);
  const checksum = await sha256(canonicalJson({ profile, research }));
  // Even unchanged effective data must capture a newly deployed ancestor, so a
  // later source edit is compared against the correct baseline.
  if (current.revision === pointer?.revision && current.lastSync?.source.checksumSha256 === downloaded.checksumSha256 && current.lastSync.contentChecksumSha256 === checksum) return current;
  const revision = crypto.randomUUID();
  const snapshot: StoredSnapshot = {
    schemaVersion: 2, revision, profile, research,
    baseline: { revision: baseline.revision, profile: baseline.profile, research: baseline.research },
    lastSync: {
      status: "success", at: new Date().toISOString(), contentChecksumSha256: checksum,
      source: {
        ...request.source,
        fetchedAt: downloaded.fetchedAt, byteLength: downloaded.bytes.byteLength,
        ...(downloaded.upstreamETag ? { upstreamETag: downloaded.upstreamETag } : {}),
        ...(downloaded.upstreamLastModified ? { upstreamLastModified: downloaded.upstreamLastModified } : {}),
      },
    },
  };
  const serialized = JSON.stringify(snapshot);
  if (new TextEncoder().encode(serialized).byteLength > MAX_SNAPSHOT_BYTES) throw new ContentError(413, "snapshot_too_large", "The merged snapshot exceeds the storage limit.");
  await bucket.put(`${REVISION_PREFIX}${revision}.json`, serialized, { httpMetadata: { contentType: "application/json" } });
  // Readback verifies the complete immutable revision before changing the single
  // current pointer. Conditional put prevents lost updates between concurrent runs.
  await readRevision(bucket, revision);
  const nextPointer: Pointer = { revision, ...(pointer ? { previousRevision: pointer.revision } : {}) };
  const committed = await bucket.put(POINTER_KEY, JSON.stringify(nextPointer), {
    httpMetadata: { contentType: "application/json" },
    onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
  });
  if (!committed) throw new ContentError(409, "revision_conflict", "Another update completed first. Read and reconcile the latest content before retrying.");
  return withBaseline(baseline, snapshot, "live");
}
