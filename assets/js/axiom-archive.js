(() => {
  "use strict";

  const INDEX_URL = "/assets/data/axiom-public-evidence.json";
  const BUNDLE_SCHEMA = "semeai.axiom-evidence-bundle.v0.1";
  const MAX_QUERY_LENGTH = 256;
  const MAX_RESULTS = 8;
  let indexPromise = null;

  function normalize(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}_-]+/gu, " ")
      .trim();
  }

  function tokens(value) {
    return [...new Set(normalize(value).split(/\s+/).filter((token) => token.length >= 2))];
  }

  function searchableText(entry) {
    return normalize([
      entry.sourceId,
      entry.title,
      entry.summary,
      entry.evidenceType,
      entry.admissionState,
      entry.date,
      entry.version,
      ...(entry.keywords || []),
      ...(entry.routeContexts || []),
      JSON.stringify(entry.facts || {}),
    ].join(" "));
  }

  function scoreEntry(entry, queryTokens, routeContext) {
    const text = searchableText(entry);
    let score = 0;
    queryTokens.forEach((token) => {
      if (text.includes(token)) score += token.length >= 6 ? 3 : 2;
      if (normalize(entry.title).includes(token)) score += 3;
      if ((entry.keywords || []).some((keyword) => normalize(keyword).includes(token))) score += 2;
    });
    if (score > 0 && routeContext && (entry.routeContexts || []).includes(routeContext)) score += 2;
    return score;
  }

  async function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(INDEX_URL, {
        credentials: "same-origin",
        cache: "no-store",
      })
        .then((response) => {
          if (!response.ok) throw new Error(`Axiom public index returned ${response.status}`);
          return response.json();
        })
        .then((index) => {
          if (
            index.schemaVersion !== "semeai.axiom-public-evidence-index.v0.1" ||
            index.visibilityPolicy?.privateArchiveIncluded !== false ||
            index.visibilityPolicy?.rawArchiveIncluded !== false ||
            index.visibilityPolicy?.onlineIngestionEnabled !== false ||
            !Array.isArray(index.entries)
          ) {
            throw new Error("Axiom public index contract is invalid");
          }
          if (index.entries.some((entry) => entry.visibility !== "PUBLIC")) {
            throw new Error("Axiom public index contains a non-public entry");
          }
          return index;
        })
        .catch((error) => {
          indexPromise = null;
          throw error;
        });
    }
    return indexPromise;
  }

  async function search(question, options = {}) {
    const boundedQuestion = String(question || "").trim().slice(0, MAX_QUERY_LENGTH);
    const queryTokens = tokens(boundedQuestion);
    const routeContext = normalize(options.routeContext || options.route || "");
    const limit = Math.max(1, Math.min(MAX_RESULTS, Number(options.limit) || 5));
    const index = await loadIndex();
    const matches = queryTokens.length
      ? index.entries
          .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens, routeContext) }))
          .filter((candidate) => candidate.score > 0)
          .sort((left, right) => right.score - left.score || left.entry.sourceId.localeCompare(right.entry.sourceId))
          .slice(0, limit)
      : [];

    return {
      schemaVersion: BUNDLE_SCHEMA,
      query: boundedQuestion,
      routeContext: routeContext || null,
      noEvidence: matches.length === 0,
      evidence: matches.map(({ entry, score }) => ({
        sourceId: entry.sourceId,
        title: entry.title,
        summary: entry.summary,
        evidenceType: entry.evidenceType,
        visibility: entry.visibility,
        admissionState: entry.admissionState,
        date: entry.date,
        version: entry.version,
        route: entry.route,
        source: { ...entry.source },
        facts: { ...entry.facts },
        relevanceScore: score,
        contentTrust: "UNTRUSTED_DATA",
      })),
      authority: {
        retrievalIsTruth: false,
        retrievalIsReleaseAuthority: false,
        candidateAnswerProduced: false,
        releaseAuthority: "SaC/PoR Gate",
      },
    };
  }

  window.SemeAI_AxiomArchive = Object.freeze({
    loadIndex,
    search,
    indexUrl: INDEX_URL,
    bundleSchema: BUNDLE_SCHEMA,
  });
})();
