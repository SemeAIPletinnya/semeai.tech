import crypto from "node:crypto";

export const HISTORICAL_POLICY_VERSION = "semeai.genesis.historical-admission.v1";

export const PROVENANCE_CLASSES = Object.freeze([
  "PUBLIC_FIRST_PARTY_POST",
  "PUBLIC_REPOSITORY",
  "PUBLIC_COMMIT",
  "PUBLIC_RELEASE",
  "PUBLIC_DOCUMENT",
  "PRODUCTION_SURFACE",
  "TEST_EVIDENCE",
  "RECEIPT",
  "PRIVATE_ARCHIVE",
  "PRIVATE_CONVERSATION",
  "EXTERNAL_PUBLIC_REACTION",
  "DERIVED_METADATA",
  "UNKNOWN",
]);

export const CLAIM_TYPES = Object.freeze([
  "HISTORICAL_LANGUAGE",
  "CONCEPT_EMERGENCE",
  "METHODOLOGY",
  "IMPLEMENTATION",
  "MEASURED_RESULT",
  "PUBLIC_REACTION",
  "RELEASE",
  "PRODUCTION",
  "RESEARCH",
  "HYPOTHESIS",
  "HISTORICAL_FRAMING",
]);

export const ADMISSION_STATES = Object.freeze(["ADMIT", "REVIEW", "WITHHOLD"]);

const PRIVATE_CLASSES = new Set(["PRIVATE_ARCHIVE", "PRIVATE_CONVERSATION"]);
const IMPLEMENTATION_AUTHORITIES = new Set([
  "PUBLIC_REPOSITORY",
  "PUBLIC_COMMIT",
  "PUBLIC_RELEASE",
  "TEST_EVIDENCE",
  "RECEIPT",
  "PRODUCTION_SURFACE",
]);

function compareKeys(left, right) {
  return String(left).localeCompare(String(right), "en");
}
export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareKeys)
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function stableStringify(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertEnum(value, allowed, field) {
  if (!allowed.includes(value)) throw new Error(`Invalid ${field}: ${value}`);
}

function normalizeRefs(refs) {
  return [...new Set((refs || []).map(String).filter(Boolean))].sort(compareKeys);
}

export function normalizeHistoricalArtifact(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Historical artifact must be an object");
  }
  const artifact = {
    artifact_id: String(input.artifact_id || "").trim(),
    event_id: String(input.event_id || input.artifact_id || "").trim(),
    provenance_class: String(input.provenance_class || "UNKNOWN"),
    claim_type: String(input.claim_type || "HYPOTHESIS"),
    public_status: String(input.public_status || "UNKNOWN"),
    timestamp: input.timestamp == null ? null : String(input.timestamp),
    timestamp_confidence: String(input.timestamp_confidence || "UNKNOWN"),
    material: input.material === true,
    provenance_sufficient: input.provenance_sufficient === true,
    claim_bounded: input.claim_bounded === true,
    privacy_permits_publication: input.privacy_permits_publication === true,
    implementation_claim: input.implementation_claim === true,
    validation_claim: input.validation_claim === true,
    current_capability_claim: input.current_capability_claim === true,
    causality_claim: input.causality_claim === true,
    causality_supported: input.causality_supported === true,
    conflict_state: String(input.conflict_state || "NONE"),
    source_url: input.source_url == null ? null : String(input.source_url),
    evidence_refs: normalizeRefs(input.evidence_refs),
    supports: normalizeRefs(input.supports),
    does_not_support: normalizeRefs(input.does_not_support),
  };
  if (!artifact.artifact_id) throw new Error("artifact_id is required");
  assertEnum(artifact.provenance_class, PROVENANCE_CLASSES, "provenance_class");
  assertEnum(artifact.claim_type, CLAIM_TYPES, "claim_type");
  if (artifact.timestamp !== null && Number.isNaN(Date.parse(artifact.timestamp))) {
    throw new Error(`Invalid timestamp: ${artifact.artifact_id}`);
  }
  return artifact;
}

export function evaluateHistoricalAdmission(input) {
  const artifact = normalizeHistoricalArtifact(input);
  const reasons = [];
  let state = "ADMIT";

  if (
    PRIVATE_CLASSES.has(artifact.provenance_class) ||
    artifact.public_status === "PRIVATE" ||
    artifact.privacy_permits_publication !== true
  ) {
    state = "WITHHOLD";
    reasons.push("privacy_boundary");
  }
  if (!artifact.material) {
    state = "WITHHOLD";
    reasons.push("not_material");
  }
  if (artifact.provenance_class === "UNKNOWN") {
    state = "WITHHOLD";
    reasons.push("unknown_source");
  }
  if (artifact.current_capability_claim && artifact.claim_type === "HISTORICAL_FRAMING") {
    state = "WITHHOLD";
    reasons.push("historical_language_exceeds_current_authority");
  }
  if (artifact.implementation_claim && !IMPLEMENTATION_AUTHORITIES.has(artifact.provenance_class)) {
    state = "WITHHOLD";
    reasons.push("source_is_not_implementation_authority");
  }
  if (
    artifact.validation_claim &&
    artifact.provenance_class === "EXTERNAL_PUBLIC_REACTION"
  ) {
    state = "WITHHOLD";
    reasons.push("reaction_is_not_validation");
  }
  if (artifact.causality_claim && !artifact.causality_supported) {
    state = state === "WITHHOLD" ? state : "REVIEW";
    reasons.push("chronology_is_not_causality");
  }

  if (state !== "WITHHOLD") {
    if (!artifact.provenance_sufficient) reasons.push("provenance_incomplete");
    if (!artifact.claim_bounded) reasons.push("claim_boundary_incomplete");
    if (artifact.timestamp_confidence === "LOW" || artifact.timestamp_confidence === "UNKNOWN") {
      reasons.push("timestamp_uncertain");
    }
    if (artifact.public_status === "AMBIGUOUS") reasons.push("public_status_ambiguous");
    if (artifact.conflict_state !== "NONE") reasons.push("conflicting_evidence");
    if (reasons.length > 0) state = "REVIEW";
  }

  return {
    artifact_id: artifact.artifact_id,
    state,
    reasons: [...new Set(reasons)].sort(compareKeys),
    policy_version: HISTORICAL_POLICY_VERSION,
  };
}

export function validateLineageEdge(input) {
  if (!input || typeof input !== "object") throw new Error("Lineage edge must be an object");
  const relation = String(input.relation || "");
  const evidenceRefs = normalizeRefs(input.evidence_refs);
  if (!String(input.from || "") || !String(input.to || "")) {
    throw new Error("Lineage edge endpoints are required");
  }
  if (!evidenceRefs.length) throw new Error("Lineage edge requires evidence");
  if (["EVOLVED_INTO", "REFINED_BY", "INSPIRED"].includes(relation) && input.causality_supported !== true) {
    throw new Error(`${relation} requires causal support`);
  }
  return {
    from: String(input.from),
    to: String(input.to),
    relation: relation || "PRECEDED",
    evidence_refs: evidenceRefs,
    causality_supported: input.causality_supported === true,
  };
}

export function deduplicateArtifacts(inputs) {
  const groups = new Map();
  for (const input of inputs || []) {
    const artifact = normalizeHistoricalArtifact(input);
    const key = artifact.event_id || artifact.artifact_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(artifact);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => compareKeys(left, right))
    .map(([eventId, representations]) => ({
      event_id: eventId,
      artifact_ids: representations.map((item) => item.artifact_id).sort(compareKeys),
      representations: representations.length,
    }));
}

function assertPublicSafe(value, path = "$") {
  if (typeof value === "string") {
    if (/(?:[A-Za-z]:\\|file:\/\/|aedf2e2d53456|twitter-2026-05-30)/i.test(value)) {
      throw new Error(`Public manifest contains a protected path or archive identifier at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPublicSafe(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/raw|private|source_path|local_path|conversation|transcript/i.test(key)) {
        throw new Error(`Public manifest contains a protected field at ${path}.${key}`);
      }
      assertPublicSafe(item, `${path}.${key}`);
    }
  }
}

export function buildSanitizedManifest(inputs, options = {}) {
  const admitted = [];
  const decisions = [];
  for (const input of inputs || []) {
    const artifact = normalizeHistoricalArtifact(input);
    const decision = evaluateHistoricalAdmission(artifact);
    decisions.push(decision);
    if (decision.state !== "ADMIT") continue;
    const publicRecord = {
      artifact_id: artifact.artifact_id,
      event_id: artifact.event_id,
      provenance_class: artifact.provenance_class,
      claim_type: artifact.claim_type,
      timestamp: artifact.timestamp,
      timestamp_confidence: artifact.timestamp_confidence,
      source_url:
        artifact.source_url && /^https:\/\//.test(artifact.source_url)
          ? artifact.source_url
          : null,
      evidence_refs: artifact.evidence_refs,
      supports: artifact.supports,
      does_not_support: artifact.does_not_support,
      admission: decision,
    };
    assertPublicSafe(publicRecord);
    admitted.push(publicRecord);
  }
  admitted.sort((left, right) => {
    const dateOrder = String(left.timestamp || "").localeCompare(String(right.timestamp || ""));
    return dateOrder || compareKeys(left.artifact_id, right.artifact_id);
  });
  const manifest = {
    schema: "semeai.genesis.historical-evidence.v1",
    policy_version: HISTORICAL_POLICY_VERSION,
    generated_from: String(options.generated_from || "curated-public-authority"),
    artifacts: admitted,
    summary: {
      admitted: admitted.length,
      review: decisions.filter((item) => item.state === "REVIEW").length,
      withheld: decisions.filter((item) => item.state === "WITHHOLD").length,
    },
  };
  assertPublicSafe(manifest);
  return {
    manifest,
    serialized: stableStringify(manifest),
    sha256: sha256(stableStringify(manifest)),
    decisions,
  };
}
