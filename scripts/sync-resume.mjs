#!/usr/bin/env node
// An unattended runner, not a résumé-to-facts model. Parsing/curation must be
// configured explicitly; a failed parser never overwrites the site.
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const options = new Set(["--dry-run", "--check", "--force"]);
const args = process.argv.slice(2);
const parsed = {};
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (options.has(arg)) parsed[arg.slice(2)] = true;
  else if (["--site", "--snapshot"].includes(arg) && args[index + 1]) parsed[arg.slice(2)] = args[++index];
  else throw new Error("Usage: node scripts/sync-resume.mjs --site https://SITE [--snapshot FILE.json] [--check] [--dry-run] [--force]");
}

function fail(message) { throw new Error(message); }
const target = new URL(parsed.site || process.env.SITE_URL || fail("Set --site or SITE_URL."));
if (target.username || target.password || target.search || target.hash || target.pathname !== "/") fail("Use the site origin without credentials, path, or query.");
if (target.protocol !== "https:" && !(target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname))) fail("The site must use HTTPS (except local preview).");
const site = target.origin;
const maxSourceBytes = 20 * 1024 * 1024;
const maxCommandBytes = 3 * 1024 * 1024;
const baseHeaders = {};
// Sites service access and application-level write authorization are separate.
// Both values come from the runner's secret store, never command arguments.
if (process.env.OAI_SITES_TOKEN) baseHeaders["OAI-Sites-Authorization"] = `Bearer ${process.env.OAI_SITES_TOKEN}`;

async function siteFetch(path, init = {}) {
  const response = await fetch(`${site}${path}`, {
    ...init,
    headers: { ...baseHeaders, ...init.headers },
    redirect: "manual",
    signal: AbortSignal.timeout(90_000),
  });
  if (response.status >= 300 && response.status < 400) fail("The site redirected the runner. Configure supported Sites service access; interactive sign-in cannot run unattended.");
  if (!response.ok) {
    let code = `HTTP ${response.status}`;
    try { const body = await response.json(); if (typeof body.error === "string") code = body.error; } catch { /* Never print a source body or a login page. */ }
    fail(`The site request failed (${code}). No content was changed.`);
  }
  return response;
}

async function boundedBytes(response, maximum) {
  if (Number(response.headers.get("content-length") || 0) > maximum || !response.body) fail("The source is empty or too large.");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximum) { await reader.cancel(); fail("The source exceeds the download limit."); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, length);
}

function commandFromEnvironment(key) {
  if (!process.env[key]) return null;
  let command;
  try { command = JSON.parse(process.env[key]); } catch { fail(`${key} must be a JSON array of command arguments.`); }
  if (!Array.isArray(command) || command.length === 0 || command.some((item) => typeof item !== "string" || !item)) fail(`${key} must be a non-empty JSON array of strings.`);
  return command;
}

function runCommand(command, input, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { shell: false, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, CONTENT_SYNC_TOKEN: "", OAI_SITES_TOKEN: "" } });
    const output = [];
    let length = 0;
    let complete = false;
    let killTimer;
    function stop(message) {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      child.kill("SIGTERM");
      // A misbehaving parser cannot keep the unattended runner alive forever.
      killTimer = setTimeout(() => {
        child.kill("SIGKILL");
        child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
      }, 2_000);
      reject(new Error(message));
    }
    const timer = setTimeout(() => stop(`${label} timed out. No content was changed.`), 120_000);
    child.stdout.on("data", (chunk) => {
      if (complete) return;
      length += chunk.length;
      if (length > maxCommandBytes) stop(`${label} returned too much output.`);
      else output.push(chunk);
    });
    // Consume stderr without echoing résumé content or command-specific secrets.
    child.stderr.resume();
    child.on("error", () => { clearTimeout(timer); clearTimeout(killTimer); complete = true; reject(new Error(`${label} could not start. Verify its configured executable.`)); });
    child.on("close", (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (complete) return;
      complete = true;
      if (code !== 0) reject(new Error(`${label} exited unsuccessfully. No content was changed.`));
      else resolve(Buffer.concat(output).toString("utf8"));
    });
    child.stdin.on("error", () => { /* A failed child is handled by close/error. */ });
    child.stdin.end(input);
  });
}

try {
  const currentResponse = await siteFetch("/api/content");
  const current = await currentResponse.json();
  if (!current.profile || !Array.isArray(current.research) || typeof current.revision !== "string") fail("The site did not return a valid complete content snapshot.");
  if (current.storage === "previous-good") fail("The site is serving a recovered revision. Repair the current content pointer before updating.");
  const sourceResponse = await siteFetch("/api/resume-source");
  if (!sourceResponse.headers.get("content-type")?.startsWith("application/pdf")) fail("The résumé endpoint returned a non-PDF response.");
  const pdf = await boundedBytes(sourceResponse, maxSourceBytes);
  if (!pdf.subarray(0, 1_024).toString("ascii").includes("%PDF-")) fail("The résumé response has no PDF header.");
  const checksumSha256 = createHash("sha256").update(pdf).digest("hex");
  if (checksumSha256 !== sourceResponse.headers.get("x-resume-sha256")) fail("The downloaded résumé failed checksum verification.");
  const fileId = sourceResponse.headers.get("x-resume-file-id");
  if (!fileId) fail("The résumé endpoint did not identify the canonical source file.");
  const source = {
    kind: "google-drive", fileId, checksumSha256, observedAt: new Date().toISOString(),
    ...(sourceResponse.headers.get("x-resume-source-etag") ? { version: sourceResponse.headers.get("x-resume-source-etag") } : {}),
  };
  if (parsed.check) {
    console.log(JSON.stringify({ changed: current.lastSync?.source?.checksumSha256 !== checksumSha256, checksumSha256, fileId, currentRevision: current.revision, lastSuccessfulSync: current.lastSync?.at || null }));
    process.exit(0);
  }
  if (!parsed.force && current.lastSync?.source?.checksumSha256 === checksumSha256) {
    console.log(JSON.stringify({ status: "unchanged", revision: current.revision }));
    process.exit(0);
  }
  let snapshot;
  if (parsed.snapshot) {
    snapshot = JSON.parse(await readFile(parsed.snapshot, "utf8"));
    if (snapshot.expectedRevision !== current.revision) fail("The prepared snapshot was not based on the current site revision. Fetch and reconcile the latest content before writing.");
    if (snapshot.source?.checksumSha256 !== checksumSha256 || snapshot.source?.fileId !== fileId) fail("The prepared snapshot belongs to a different résumé version. Reconcile it with the current PDF.");
  } else {
    const extract = commandFromEnvironment("RESUME_EXTRACT_COMMAND_JSON");
    const transform = commandFromEnvironment("RESUME_TRANSFORM_COMMAND_JSON");
    if (!extract || !transform) fail("Configure RESUME_EXTRACT_COMMAND_JSON and RESUME_TRANSFORM_COMMAND_JSON, or supply a reviewed --snapshot JSON matching the current PDF checksum. Automatic fact extraction is not configured; no content was changed.");
    const resumeText = await runCommand(extract, pdf, "PDF text extraction");
    if (resumeText.trim().length < 200) fail("The text extractor returned insufficient résumé text.");
    const transformed = await runCommand(transform, JSON.stringify({ resumeText, source, current }), "Structured résumé reconciliation");
    try { snapshot = JSON.parse(transformed); } catch { fail("The reconciliation command did not return valid JSON."); }
  }
  if (!snapshot || !snapshot.profile || !Array.isArray(snapshot.research) || snapshot.research.length === 0) fail("The reconciled snapshot must contain a complete profile and non-empty research array.");
  const payload = { expectedRevision: current.revision, profile: snapshot.profile, research: snapshot.research, source };
  if (parsed["dry-run"]) {
    console.log(JSON.stringify({ status: "ready-for-validation", checksumSha256, expectedRevision: current.revision, researchCount: snapshot.research.length, note: "No write occurred. The server validates the complete schema and source again on POST." }));
    process.exit(0);
  }
  if (!process.env.CONTENT_SYNC_TOKEN || process.env.CONTENT_SYNC_TOKEN.length < 32) fail("Set CONTENT_SYNC_TOKEN from the runner's secret store before writing.");
  const saved = await (await siteFetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CONTENT_SYNC_TOKEN}` }, body: JSON.stringify(payload) })).json();
  const verified = await (await siteFetch("/api/content")).json();
  if (verified.revision !== saved.revision || verified.lastSync?.source?.checksumSha256 !== checksumSha256) fail("The update response did not match readback. Inspect the latest site state before retrying.");
  console.log(JSON.stringify({ status: "updated", revision: verified.revision, syncedAt: verified.lastSync.at, researchCount: verified.research.length }));
} catch (error) {
  console.error(error instanceof Error ? error.message : "The résumé update failed. No successful update is claimed.");
  process.exitCode = 1;
}
