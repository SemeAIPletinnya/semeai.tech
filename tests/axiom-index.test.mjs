import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, "..");
const INDEX_PATH = path.join(ROOT, "assets", "data", "axiom-public-evidence.json");
const source = fs.readFileSync(INDEX_PATH, "utf8");
const index = JSON.parse(source);
const allowedAdmissionStates = new Set([
  "PUBLIC_CONTRACT",
  "ADMITTED_PUBLIC_COMMIT_EVIDENCE",
  "PUBLIC_GOLDEN_FIXTURE",
  "PUBLIC_CANDIDATE_EVIDENCE",
  "PUBLIC_PUBLICATION",
]);

assert.equal(index.schemaVersion, "semeai.axiom-public-evidence-index.v0.1");
assert.deepEqual(index.visibilityPolicy, {
  allowed: ["PUBLIC"],
  privateArchiveIncluded: false,
  rawArchiveIncluded: false,
  onlineIngestionEnabled: false,
});
assert.deepEqual(index.authority, {
  retrievalIsTruth: false,
  retrievalIsReleaseAuthority: false,
  candidateIsReleasedAnswer: false,
  releaseAuthority: "SaC/PoR Gate",
});
assert.equal(index.entries.length, 9);

const sourceIds = new Set();
for (const entry of index.entries) {
  assert.match(entry.sourceId, /^public:[a-z0-9:.-]+$/);
  assert.equal(sourceIds.has(entry.sourceId), false, `duplicate source id: ${entry.sourceId}`);
  sourceIds.add(entry.sourceId);
  assert.equal(entry.visibility, "PUBLIC");
  assert.equal(allowedAdmissionStates.has(entry.admissionState), true);
  assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(entry.title.length >= 8 && entry.title.length <= 120);
  assert.ok(entry.summary.length >= 40 && entry.summary.length <= 320);
  assert.ok(Array.isArray(entry.keywords) && entry.keywords.length >= 3);
  assert.ok(Array.isArray(entry.routeContexts) && entry.routeContexts.length >= 1);
  assert.match(entry.route, /^\//);
  assert.equal(entry.source.repository, "SemeAIPletinnya/semeai.tech");
  assert.match(entry.source.sha256, /^[a-f0-9]{64}$/);
  assert.ok(entry.source.identity.startsWith("semeai.tech:"));

  const evidenceFile = path.join(ROOT, ...entry.source.path.split("/"));
  assert.equal(fs.existsSync(evidenceFile), true, `${entry.sourceId} evidence file should exist`);
  const evidenceHash = crypto.createHash("sha256").update(fs.readFileSync(evidenceFile)).digest("hex");
  assert.equal(evidenceHash, entry.source.sha256, `${entry.sourceId} evidence hash should match`);
}

assert.equal(
  /[A-Z]:\\|file:\/\/|session_token|api[_-]?key|cookie|chatgpt export|raw private archive/i.test(source),
  false,
  "public index must not expose local paths, credentials, sessions, or raw private archive content",
);
assert.equal(index.entries.some((entry) => entry.facts?.admitted > 0), false);
assert.equal(index.entries.find((entry) => entry.sourceId === "public:skills:registry:v0.1").facts.admitted, 0);
assert.equal(
  index.entries.find((entry) => entry.sourceId === "public:gate:runtime-decision-contract:v0.1").facts.silenceDeletesAudit,
  false,
);

console.log(`ok - validated ${index.entries.length} deterministic public Axiom evidence entries`);
