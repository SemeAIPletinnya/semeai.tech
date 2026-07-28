import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSanitizedManifest,
  deduplicateArtifacts,
  stableStringify,
  validateLineageEdge,
} from "../lib/historical-admission.mjs";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const genesisRoot = path.resolve(toolDir, "..");
const dataRoot = path.join(genesisRoot, "data");
const sourceFile = path.join(dataRoot, "source", "historical-evidence.curation.json");
const checkOnly = process.argv.slice(2).includes("--check");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeOrCheck(file, value) {
  const serialized = stableStringify(value);
  if (checkOnly) {
    assert(fs.existsSync(file), `Missing generated historical file: ${file}`);
    assert(
      fs.readFileSync(file, "utf8") === serialized,
      `Generated historical file is stale: ${file}`
    );
  } else {
    fs.writeFileSync(file, serialized, "utf8");
  }
}

const source = readJson(sourceFile);
const built = buildSanitizedManifest(source.artifacts, {
  generated_from: "curated-public-authority",
});
const artifactIds = new Set(source.artifacts.map((item) => item.artifact_id));
assert(artifactIds.size === source.artifacts.length, "Duplicate historical artifact ids");

const decisions = {
  schema: "semeai.genesis.historical-admission-decisions.v1",
  policy_version: source.policy_version,
  boundary:
    "Public curated candidates only. Private archive decisions remain in the local index and are not published.",
  decisions: built.decisions,
  summary: {
    admit: built.decisions.filter((item) => item.state === "ADMIT").length,
    review: built.decisions.filter((item) => item.state === "REVIEW").length,
    withhold: built.decisions.filter((item) => item.state === "WITHHOLD").length,
  },
};

const admittedIds = new Set(built.manifest.artifacts.map((item) => item.artifact_id));
for (const entries of Object.values(source.timelines)) {
  for (const entry of entries) {
    assert(entry.evidence_refs.length > 0, `Timeline entry lacks evidence: ${entry.title}`);
    for (const reference of entry.evidence_refs) {
      assert(admittedIds.has(reference), `Timeline uses non-admitted evidence: ${reference}`);
    }
  }
}
const timelines = {
  schema: "semeai.genesis.timelines.v1",
  boundary:
    "Concept, publication, implementation, and evidence dates remain separate authorities.",
  timelines: source.timelines,
};

const lineage = {
  schema: "semeai.genesis.concept-lineage.v1",
  boundary:
    "PRECEDED records chronology. PARALLEL records coexistence. No edge implies causality unless causal support is explicit.",
  edges: source.lineage_edges.map(validateLineageEdge),
};

const quality = {
  schema: "semeai.genesis.evidence-quality.v1",
  boundary:
    "Evidence density is descriptive. It is not a quality score or release authority.",
  eras: source.quality_eras,
};

const duplicates = {
  schema: "semeai.genesis.duplicate-representations.v1",
  boundary:
    "Multiple representations of one event are not independent corroboration.",
  groups: deduplicateArtifacts(source.artifacts).filter(
    (group) => group.representations > 1
  ),
};

const generated = [
  ["historical-evidence.json", built.manifest],
  ["admission-decisions.json", decisions],
  ["timelines.json", timelines],
  ["concept-lineage.json", lineage],
  ["evidence-quality.json", quality],
  ["duplicate-representations.json", duplicates],
];
for (const [name, value] of generated) {
  writeOrCheck(path.join(dataRoot, name), value);
}

if (!checkOnly) {
  const files = Object.fromEntries(
    generated.map(([name]) => [name, sha256(path.join(dataRoot, name))])
  );
  writeOrCheck(path.join(dataRoot, "historical-manifest.json"), {
    schema: "semeai.genesis.historical-manifest.v1",
    policy_version: source.policy_version,
    files,
  });
} else {
  const manifest = readJson(path.join(dataRoot, "historical-manifest.json"));
  for (const [name] of generated) {
    assert(
      manifest.files[name] === sha256(path.join(dataRoot, name)),
      `Historical manifest hash is stale: ${name}`
    );
  }
}

console.log(
  `${checkOnly ? "Verified" : "Built"} ${built.manifest.artifacts.length} admitted public claims, ${decisions.summary.review} review decisions, ${decisions.summary.withhold} withheld decisions, ${lineage.edges.length} lineage edges, and ${duplicates.groups.length} duplicate groups`
);
