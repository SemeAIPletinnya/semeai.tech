import http from "node:http";
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATE_ENDPOINT = "https://api.semeai.tech/v0/demo/check";
const BODY_LIMIT = 8 * 1024;

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".png", "image/png"],
  [".webm", "video/webm"]
]);

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

async function readBoundedBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error("Request body exceeds the proof-server limit.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function proxyGate(request, response) {
  try {
    const body = await readBoundedBody(request);
    const parsed = JSON.parse(body || "{}");
    const scenarioId = String(parsed.scenario_id || "");
    if (!["supported_answer", "unsupported_claim", "fake_promo_code"].includes(scenarioId)) {
      return sendJson(response, 400, { error: "Only the three published deterministic Gate scenarios are accepted." });
    }
    const upstream = await fetch(GATE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_id: scenarioId }),
      signal: AbortSignal.timeout(12_000)
    });
    const text = await upstream.text();
    response.writeHead(upstream.status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(text),
      "Cache-Control": "no-store",
      "X-Cinematic-Authority": "PRODUCTION-GATE-PROXY"
    });
    response.end(text);
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : "Production Gate proxy failed." });
  }
}

async function proxyGithub(request, response, githubToken) {
  try {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const upstreamPath = requestUrl.pathname.replace(/^\/__cinematic__\/github/, "");
    if (!/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/.*)?$/.test(upstreamPath)) {
      return sendJson(response, 400, { error: "The GitHub proof proxy accepts repository evidence routes only." });
    }
    const headers = {
      Accept: request.headers.accept || "application/vnd.github+json",
      "User-Agent": "SemeAI-Cinematic-Evidence"
    };
    if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
    const upstream = await fetch(`https://api.github.com${upstreamPath}${requestUrl.search}`, {
      headers,
      signal: AbortSignal.timeout(12_000)
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Content-Length": body.length,
      "Cache-Control": "no-store",
      "X-Cinematic-Evidence-Source": "GITHUB-LIVE"
    });
    response.end(body);
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : "GitHub proof proxy failed." });
  }
}

function resolveStaticPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(REPOSITORY_ROOT, relative);
  if (candidate !== REPOSITORY_ROOT && !candidate.startsWith(`${REPOSITORY_ROOT}${path.sep}`)) return null;
  return candidate;
}

async function serveStatic(request, response) {
  let target = resolveStaticPath(request.url || "/");
  if (!target) return sendJson(response, 403, { error: "Path outside the prototype root." });
  try {
    let info = await stat(target);
    if (info.isDirectory()) {
      target = path.join(target, "index.html");
      info = await stat(target);
    }
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": MIME.get(path.extname(target).toLowerCase()) || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-store",
      "Cross-Origin-Opener-Policy": "same-origin"
    });
    createReadStream(target).pipe(response);
  } catch {
    sendJson(response, 404, { error: "Not found." });
  }
}

export async function startProofServer({ port = 0, githubToken = process.env.SEMEAI_CINEMATIC_GITHUB_TOKEN || "" } = {}) {
  const server = http.createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/__cinematic__/gate") {
      await proxyGate(request, response);
      return;
    }
    if (request.method === "GET" && String(request.url || "").startsWith("/__cinematic__/github/")) {
      await proxyGithub(request, response, githubToken);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    await serveStatic(request, response);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const requestedPort = Number(process.env.SEMEAI_CINEMATIC_PORT || 8765);
  const { origin } = await startProofServer({ port: requestedPort });
  process.stdout.write(`SemeAI cinematic proof server: ${origin}/cinematic-engine/\n`);
}
