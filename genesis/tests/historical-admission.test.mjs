import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HISTORICAL_POLICY_VERSION,
  buildSanitizedManifest,
  deduplicateArtifacts,
  evaluateHistoricalAdmission,
  normalizeHistoricalArtifact,
  sha256,
  stableStringify,
  validateLineageEdge,
} from "../lib/historical-admission.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const genesisRoot = path.resolve(testDir, "..");

function artifact(overrides = {}) {
  return {
    artifact_id: "x-example",
    event_id: "event-example",
    provenance_class: "PUBLIC_FIRST_PARTY_POST",
    claim_type: "HISTORICAL_LANGUAGE",
    public_status: "PUBLIC",
    timestamp: "2025-07-08T05:01:31.000Z",
    timestamp_confidence: "HIGH",
    material: true,
    provenance_sufficient: true,
    claim_bounded: true,
    privacy_permits_publication: true,
    evidence_refs: ["public-record:x-example"],
    supports: ["dated public project language"],
    does_not_support: ["implementation", "current capability"],
    ...overrides,
  };
}

assert.equal(HISTORICAL_POLICY_VERSION, "semeai.genesis.historical-admission.v1");

const admitted = evaluateHistoricalAdmission(artifact());
assert.equal(admitted.state, "ADMIT", "bounded public historical language should admit");

const review = evaluateHistoricalAdmission(
  artifact({ artifact_id: "x-review", provenance_sufficient: false })
);
assert.equal(review.state, "REVIEW");
assert.ok(review.reasons.includes("provenance_incomplete"));

const privateConversation = evaluateHistoricalAdmission(
  artifact({
    artifact_id: "private-chat",
    provenance_class: "PRIVATE_CONVERSATION",
    public_status: "PRIVATE",
    privacy_permits_publication: false,
  })
);
assert.equal(privateConversation.state, "WITHHOLD");
assert.ok(privateConversation.reasons.includes("privacy_boundary"));

const unknown = evaluateHistoricalAdmission(
  artifact({ artifact_id: "unknown", provenance_class: "UNKNOWN" })
);
assert.equal(unknown.state, "WITHHOLD");
assert.ok(unknown.reasons.includes("unknown_source"));

const publicPostImplementationClaim = evaluateHistoricalAdmission(
  artifact({
    artifact_id: "x-language-is-not-code",
    claim_type: "IMPLEMENTATION",
    implementation_claim: true,
  })
);
assert.equal(publicPostImplementationClaim.state, "WITHHOLD");
assert.ok(
  publicPostImplementationClaim.reasons.includes("source_is_not_implementation_authority")
);

const implementationCommit = evaluateHistoricalAdmission(
  artifact({
    artifact_id: "commit-implementation",
    provenance_class: "PUBLIC_COMMIT",
    claim_type: "IMPLEMENTATION",
    implementation_claim: true,
  })
);
assert.equal(implementationCommit.state, "ADMIT");

const externalReaction = evaluateHistoricalAdmission(
  artifact({
    artifact_id: "external-reaction",
    provenance_class: "EXTERNAL_PUBLIC_REACTION",
    claim_type: "PUBLIC_REACTION",
    validation_claim: true,
  })
);
assert.equal(externalReaction.state, "WITHHOLD");
assert.ok(externalReaction.reasons.includes("reaction_is_not_validation"));

const julyFraming = evaluateHistoricalAdmission(
  artifact({
    artifact_id: "x-july-framing",
    claim_type: "HISTORICAL_FRAMING",
    current_capability_claim: false,
    supports: [
      "Pletinnya + SemeAI language",
      "initiative, empathy, self-awareness, and AGI-signal terminology",
    ],
    does_not_support: [
      "AGI",
      "self-awareness",
      "OpenAI endorsement",
      "implementation",
    ],
  })
);
assert.equal(julyFraming.state, "ADMIT");

const julyInflation = evaluateHistoricalAdmission(
  artifact({
    artifact_id: "x-july-inflated",
    claim_type: "HISTORICAL_FRAMING",
    current_capability_claim: true,
  })
);
assert.equal(julyInflation.state, "WITHHOLD");
assert.ok(
  julyInflation.reasons.includes("historical_language_exceeds_current_authority")
);

const duplicateGroups = deduplicateArtifacts([
  artifact({ artifact_id: "x-source", event_id: "event-one" }),
  artifact({
    artifact_id: "archive-record",
    event_id: "event-one",
    provenance_class: "DERIVED_METADATA",
  }),
  artifact({ artifact_id: "event-two", event_id: "event-two" }),
]);
assert.deepEqual(duplicateGroups, [
  {
    event_id: "event-one",
    artifact_ids: ["archive-record", "x-source"],
    representations: 2,
  },
  {
    event_id: "event-two",
    artifact_ids: ["event-two"],
    representations: 1,
  },
]);

const conflict = evaluateHistoricalAdmission(
  artifact({ artifact_id: "conflict", conflict_state: "IMPLEMENTATION_DATE_CONFLICT" })
);
assert.equal(conflict.state, "REVIEW");
assert.ok(conflict.reasons.includes("conflicting_evidence"));

const chronologicalOnly = evaluateHistoricalAdmission(
  artifact({
    artifact_id: "chronology-only",
    causality_claim: true,
    causality_supported: false,
  })
);
assert.equal(chronologicalOnly.state, "REVIEW");
assert.ok(chronologicalOnly.reasons.includes("chronology_is_not_causality"));

assert.deepEqual(
  validateLineageEdge({
    from: "concept",
    to: "implementation",
    relation: "PRECEDED",
    evidence_refs: ["artifact:concept", "commit:implementation"],
  }),
  {
    from: "concept",
    to: "implementation",
    relation: "PRECEDED",
    evidence_refs: ["artifact:concept", "commit:implementation"],
    causality_supported: false,
  }
);
assert.throws(
  () =>
    validateLineageEdge({
      from: "concept",
      to: "implementation",
      relation: "EVOLVED_INTO",
      evidence_refs: ["artifact:concept"],
    }),
  /causal support/
);
assert.throws(
  () =>
    validateLineageEdge({
      from: "concept",
      to: "implementation",
      relation: "PRECEDED",
      evidence_refs: [],
    }),
  /requires evidence/
);

assert.throws(() => normalizeHistoricalArtifact(null), /must be an object/);
assert.throws(
  () => normalizeHistoricalArtifact(artifact({ provenance_class: "MADE_UP" })),
  /Invalid provenance_class/
);
assert.throws(
  () => normalizeHistoricalArtifact(artifact({ timestamp: "not-a-date" })),
  /Invalid timestamp/
);

const conceptAndImplementation = [
  artifact({
    artifact_id: "concept-date",
    event_id: "concept-date",
    timestamp: "2025-09-11T15:56:13.000Z",
    claim_type: "HISTORICAL_LANGUAGE",
  }),
  artifact({
    artifact_id: "implementation-date",
    event_id: "implementation-date",
    timestamp: "2025-12-26T10:03:59.000Z",
    provenance_class: "PUBLIC_COMMIT",
    claim_type: "IMPLEMENTATION",
    implementation_claim: true,
  }),
];
assert.notEqual(
  conceptAndImplementation[0].timestamp,
  conceptAndImplementation[1].timestamp,
  "concept and implementation dates must remain distinct"
);

const built = buildSanitizedManifest([
  ...conceptAndImplementation,
  artifact({
    artifact_id: "private-withheld",
    provenance_class: "PRIVATE_CONVERSATION",
    public_status: "PRIVATE",
    privacy_permits_publication: false,
  }),
]);
const rebuilt = buildSanitizedManifest([
  ...conceptAndImplementation,
  artifact({
    artifact_id: "private-withheld",
    provenance_class: "PRIVATE_CONVERSATION",
    public_status: "PRIVATE",
    privacy_permits_publication: false,
  }),
]);
assert.equal(built.serialized, rebuilt.serialized, "sanitized manifest must be deterministic");
assert.equal(built.sha256, rebuilt.sha256, "sanitized manifest hash must be stable");
assert.equal(built.manifest.summary.admitted, 2);
assert.equal(built.manifest.summary.withheld, 1);
assert.ok(!built.serialized.includes("private-withheld"));
assert.ok(!built.serialized.includes("PRIVATE_CONVERSATION"));

const noPublicUrl = buildSanitizedManifest([
  artifact({ artifact_id: "public-document-without-url", source_url: null }),
]);
assert.equal(noPublicUrl.manifest.artifacts[0].source_url, null);

assert.throws(
  () =>
    buildSanitizedManifest([
      artifact({
        artifact_id: "path-leak",
        supports: ["C:\\Users\\User\\private\\archive.json"],
      }),
    ]),
  /protected path/
);
assert.throws(
  () =>
    buildSanitizedManifest([
      artifact({
        artifact_id: "archive-id-leak",
        supports: ["aedf2e2d53456 source"],
      }),
    ]),
  /protected path/
);

assert.equal(
  sha256(stableStringify({ b: 2, a: 1 })),
  sha256(stableStringify({ a: 1, b: 2 })),
  "canonical key order must be stable"
);

assert.ok(
  fs.existsSync(path.join(genesisRoot, "archive", "v02", "index.html")),
  "Genesis v02 archive must remain preserved"
);
for (const file of [
  "artifacts.json",
  "chronicle.json",
  "eras.json",
  "lineage.json",
  "manifest.json",
  "milestones.json",
  "repositories.json",
]) {
  assert.ok(fs.existsSync(path.join(genesisRoot, "data", file)), `Genesis v03 file missing: ${file}`);
}

const genesisHtml = fs.readFileSync(path.join(genesisRoot, "index.html"), "utf8");
assert.match(genesisHtml, /data-genesis-version="v04"/);
assert.match(genesisHtml, /id="historical-foundation"/);
assert.match(genesisHtml, /id="historical-provenance"/);
assert.match(genesisHtml, /id="chronicle"/);

const chronicle = JSON.parse(
  fs.readFileSync(path.join(genesisRoot, "data", "chronicle.json"), "utf8")
);
assert.ok(Array.isArray(chronicle.entries) && chronicle.entries.length > 0);
assert.ok(
  chronicle.entries.every(
    (entry) =>
      entry.status.startsWith("ADMITTED") &&
      Array.isArray(entry.source_references) &&
      entry.source_references.length > 0 &&
      entry.source_references.every((source) => /^https:\/\/github\.com\//.test(source))
  ),
  "Chronicle entries must retain admitted source references"
);

console.log("ok - 25 Genesis historical admission and v04 assertions passed");
