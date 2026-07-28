(() => {
  "use strict";

  const page = document.body?.dataset.productRoute || "";
  if (!page || !window.SemeAI) return;

  const byId = (id) => document.getElementById(id);
  const text = (node, value) => {
    if (node) node.textContent = value == null || value === "" ? "—" : String(value);
  };
  const t = (key, fallback, vars) => {
    const value = window.SemeAI_I18n?.t?.(key, vars);
    return value && value !== key ? value : fallback;
  };
  const receiptsFrom = (payload) => (Array.isArray(payload?.receipts) ? payload.receipts : []);

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
  }

  function showMessage(node, message) {
    if (!node) return;
    node.textContent = message;
    node.hidden = !message;
  }

  function errorMessage(error) {
    if (!error) return t("account.error.generic", "The account service did not complete this request.");
    if (error.status === 401 || error.status === 403) return t("account.error.auth", "The session or credentials were not accepted.");
    if (error.status === 409) return t("account.error.conflict", "That account or workspace already exists.");
    return error.message || t("account.error.generic", "The account service did not complete this request.");
  }

  function subscriptionFrom(bundle) {
    return bundle.account?.subscription || bundle.profile?.subscription || {};
  }

  function billingFrom(bundle) {
    return bundle.billing || bundle.account?.billing || bundle.profile?.billing || {};
  }

  function workspaceName(bundle) {
    return bundle.account?.workspace_name || bundle.profile?.workspace_name || t("account.value.unavailable", "Not returned");
  }

  function workspaceId(bundle) {
    return bundle.account?.workspace_id || bundle.profile?.workspace_id || t("account.value.unavailable", "Not returned");
  }

  function accountEmail(bundle) {
    return bundle.account?.email || bundle.profile?.email || t("account.value.emailUnavailable", "Not returned by the current account endpoint");
  }

  function planLabel(bundle) {
    const subscription = subscriptionFrom(bundle);
    return subscription.tier || subscription.plan || bundle.account?.plan || t("account.value.unavailable", "Not returned");
  }

  function billingLabel(bundle) {
    const billing = billingFrom(bundle);
    return billing.status || billing.state || billing.subscription_status || t("account.value.unavailable", "Not returned");
  }

  function usageLabel(bundle) {
    const usage = bundle.usage || bundle.account?.usage;
    const today = usage?.checks_today;
    const remaining = usage?.remaining_today;
    if (Number.isFinite(Number(today)) && Number.isFinite(Number(remaining))) return `${Number(today)} / ${Number(remaining)}`;
    return t("account.value.unavailable", "Not returned");
  }

  async function loadAccountBundle(profile = null) {
    const token = SemeAI.getStoredToken();
    if (!token) {
      const error = new Error("No session");
      error.status = 401;
      throw error;
    }
    const [account, usage, receipts, billing, skills] = await Promise.all([
      SemeAI.account(token),
      SemeAI.usage(token).catch(() => null),
      SemeAI.receipts(token, 100).catch(() => ({ receipts: [] })),
      SemeAI.billingStatus(token).catch(() => null),
      SemeAI.workspaceSkills(token, 100)
        .then((result) => ({ ...result, connection: "connected" }))
        .catch((error) => ({
          records: [],
          count: 0,
          connection: "unavailable",
          error_status: error?.status || null,
        })),
    ]);
    return { token, profile: profile || {}, account, usage, receipts, billing, skills };
  }

  function bindSignOut(button, statusNode, redirect = "/account/") {
    button?.addEventListener("click", async () => {
      setBusy(button, true);
      showMessage(statusNode, t("account.signout.running", "Ending the current session…"));
      try {
        await SemeAI.logout(SemeAI.getStoredToken());
      } catch {
        // Local invalidation still ends use of the current browser credential.
      } finally {
        SemeAI.clearSession();
        location.replace(redirect);
      }
    });
  }

  function extractVerificationToken() {
    try {
      const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
      return (hash.get("verify") || hash.get("verification_token") || "").trim();
    } catch {
      return "";
    }
  }

  function initAccount() {
    const loading = byId("account-loading");
    const signedOut = byId("account-signed-out");
    const signedIn = byId("account-signed-in");
    const formStatus = byId("account-form-status");
    const formAlert = byId("account-form-alert");
    let currentBundle = null;

    function switchMode(mode, focus = false) {
      document.querySelectorAll("[data-auth-mode]").forEach((button) => {
        const selected = button.dataset.authMode === mode;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected && focus) button.focus();
      });
      [
        ["login", byId("account-login-panel")],
        ["register", byId("account-register-panel")],
        ["verify", byId("account-verify-panel")],
      ].forEach(([name, panel]) => {
        if (panel) panel.hidden = name !== mode;
      });
    }

    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => switchMode(button.dataset.authMode));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const tabs = [...document.querySelectorAll("[data-auth-mode]")];
        let index = tabs.indexOf(button);
        if (event.key === "Home") index = 0;
        else if (event.key === "End") index = tabs.length - 1;
        else index = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        event.preventDefault();
        switchMode(tabs[index].dataset.authMode, true);
      });
    });

    function renderSignedOut() {
      loading.hidden = true;
      signedIn.hidden = true;
      signedOut.hidden = false;
    }

    function renderSignedIn(bundle) {
      currentBundle = bundle;
      loading.hidden = true;
      signedOut.hidden = true;
      signedIn.hidden = false;
      text(byId("account-workspace-name"), workspaceName(bundle));
      text(byId("account-email"), accountEmail(bundle));
      text(byId("account-workspace-id"), workspaceId(bundle));
      text(byId("account-plan"), planLabel(bundle));
      text(byId("account-usage"), usageLabel(bundle));
      text(byId("account-billing"), billingLabel(bundle));
      text(byId("account-receipt-count"), receiptsFrom(bundle.receipts).length);
    }

    async function acceptAuthenticatedResponse(data, remember) {
      const token = data?.session_token;
      if (!token) throw new Error(t("account.error.noSession", "The account service did not return a browser session."));
      SemeAI.setSessionToken(token, { remember });
      const bundle = await loadAccountBundle(data);
      renderSignedIn(bundle);
      showMessage(byId("account-session-status"), t("account.session.ready", "Identity and workspace access are active."));
      return bundle;
    }

    byId("account-login-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      showMessage(formAlert, "");
      showMessage(formStatus, t("account.login.running", "Signing in through the existing account service…"));
      const submit = event.currentTarget.querySelector('[type="submit"]');
      setBusy(submit, true);
      try {
        const data = await SemeAI.login({
          email: byId("account-login-email").value.trim(),
          password: byId("account-login-password").value,
        });
        await acceptAuthenticatedResponse(data, byId("account-login-remember").checked);
        showMessage(formStatus, "");
      } catch (error) {
        showMessage(formStatus, "");
        showMessage(formAlert, errorMessage(error));
      } finally {
        setBusy(submit, false);
      }
    });

    byId("account-register-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      showMessage(formAlert, "");
      const password = byId("account-register-password").value;
      const confirmation = byId("account-register-confirm").value;
      if (password !== confirmation) {
        showMessage(formAlert, t("account.error.passwordMatch", "The password confirmation does not match."));
        return;
      }
      showMessage(formStatus, t("account.register.running", "Creating the account and its single governed workspace…"));
      const submit = event.currentTarget.querySelector('[type="submit"]');
      setBusy(submit, true);
      try {
        const payload = {
          email: byId("account-register-email").value.trim(),
          company: byId("account-register-workspace").value.trim(),
          password,
          password_confirm: confirmation,
          use_case: "internal_tools",
          expected_monthly_checks: "pilot",
          notes: "",
          source: "https://semeai.tech/account/",
        };
        const data = await SemeAI.register(payload);
        const verification = data?.verification || data?.email_verification || {};
        const verificationUrl = verification.verification_url || "";
        if (verificationUrl) {
          try {
            const parsed = new URL(verificationUrl, location.origin);
            const token = new URLSearchParams(parsed.hash.replace(/^#/, "")).get("verify");
            if (token) byId("account-verification-token").value = token;
          } catch {
            // A verification URL is optional response metadata; ignore malformed values.
          }
        }
        switchMode("verify");
        showMessage(
          formStatus,
          verification.email_sent === false
            ? t("account.register.pending", "Workspace created. Enter the verification token returned by the current account service.")
            : t("account.register.sent", "Workspace created. Check the account email, then enter the verification token.")
        );
      } catch (error) {
        showMessage(formStatus, "");
        showMessage(formAlert, errorMessage(error));
      } finally {
        setBusy(submit, false);
      }
    });

    byId("account-verify-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      showMessage(formAlert, "");
      showMessage(formStatus, t("account.verify.running", "Verifying the account through the existing service…"));
      const submit = event.currentTarget.querySelector('[type="submit"]');
      setBusy(submit, true);
      try {
        const data = await SemeAI.verify(byId("account-verification-token").value.trim());
        const apiKey = data?.api_key || data?.key || "";
        if (apiKey) {
          const keyPanel = byId("account-key-once");
          text(byId("account-key-value"), apiKey);
          signedIn.insertBefore(keyPanel, signedIn.querySelector(".account-actions"));
          keyPanel.hidden = false;
        }
        await acceptAuthenticatedResponse(data, false);
        showMessage(formStatus, "");
        history.replaceState(null, "", `${location.pathname}${location.search}`);
      } catch (error) {
        showMessage(formStatus, "");
        showMessage(formAlert, errorMessage(error));
      } finally {
        setBusy(submit, false);
      }
    });

    byId("account-key-copy")?.addEventListener("click", async () => {
      const value = byId("account-key-value")?.textContent || "";
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        showMessage(byId("account-key-status"), t("account.key.copied", "Integration key copied."));
      } catch {
        showMessage(byId("account-key-status"), t("account.key.copyFailed", "Copy was unavailable. Select the key manually."));
      }
    });

    bindSignOut(byId("account-sign-out"), byId("account-session-status"));

    const verificationToken = extractVerificationToken();
    if (verificationToken) {
      byId("account-verification-token").value = verificationToken;
      switchMode("verify");
    } else {
      switchMode("login");
    }

    const token = SemeAI.getStoredToken();
    if (!token) {
      renderSignedOut();
      return;
    }

    loadAccountBundle()
      .then(renderSignedIn)
      .catch((error) => {
        if (error.status === 401 || error.status === 403) SemeAI.clearSession();
        renderSignedOut();
        if (error.status !== 401 && error.status !== 403) showMessage(formAlert, errorMessage(error));
      });

    window.addEventListener("semeai:lang", () => {
      if (currentBundle) renderSignedIn(currentBundle);
    });
  }

  function normalizedAction(receipt) {
    const action = String(receipt?.action || "").toUpperCase();
    return ["SHOW", "REVIEW", "BLOCK"].includes(action) ? action : "";
  }

  function formatTimestamp(value) {
    if (!value) return t("workspace.receipt.timeUnavailable", "Time not returned");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const lang = window.SemeAI_I18n?.lang || "en";
    const locale = lang === "uk" ? "uk-UA" : lang === "ru" ? "ru-RU" : "en-GB";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function createReceiptRow(receipt) {
    const row = document.createElement("article");
    row.className = "workspace-receipt";
    const action = normalizedAction(receipt) || t("workspace.receipt.unclassified", "UNCLASSIFIED");
    row.dataset.action = normalizedAction(receipt);

    const actionNode = document.createElement("strong");
    actionNode.className = "workspace-receipt-action";
    actionNode.textContent = action;

    const idNode = document.createElement("code");
    idNode.textContent = receipt?.receipt_id || t("workspace.receipt.idUnavailable", "Receipt ID not returned");

    const internalNode = document.createElement("span");
    internalNode.textContent = receipt?.internal_decision || t("workspace.receipt.internalUnavailable", "Internal decision not returned");

    const timeNode = document.createElement("span");
    timeNode.textContent = formatTimestamp(receipt?.timestamp);

    row.append(actionNode, idNode, internalNode, timeNode);
    return row;
  }

  const publicSkillEvidencePath = /^\/skills\/data\/[a-z0-9-]+-evidence\.json$/;

  function recordsFrom(payload) {
    return Array.isArray(payload?.records) ? payload.records : [];
  }

  function createNode(name, className, value) {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }

  async function loadPublicSkillCatalog() {
    const registryResponse = await fetch("/skills/data/registry.json", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!registryResponse.ok) throw new Error("The public skill registry could not be loaded.");
    const registry = await registryResponse.json();
    const skills = Array.isArray(registry?.skills) ? registry.skills : [];
    return Promise.all(
      skills.map(async (skill) => {
        if (!publicSkillEvidencePath.test(skill?.evaluation_reference || "")) {
          throw new Error("A public skill evidence reference was outside the bounded catalog.");
        }
        const evidenceResponse = await fetch(skill.evaluation_reference, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (!evidenceResponse.ok) throw new Error("Public skill evidence could not be loaded.");
        return { skill, evidence: await evidenceResponse.json() };
      }),
    );
  }

  function publicSkillPayload(skill, evidence) {
    const evidenceCases = (evidence.cases || []).slice(0, 32).map((item) => {
      const deployment =
        typeof item.deployment === "object"
          ? item.deployment.status
          : item.deployment === true
            ? "LIVE VERIFIED"
            : item.deployment === false
              ? "NOT DEPLOYED"
              : "NOT CAPTURED";
      const evidenceRefs = (item.source_artifacts || []).slice(0, 24).map((artifact) =>
        `${artifact.name}: ${artifact.sha256 ? `sha256:${artifact.sha256}` : "HASH NOT CAPTURED"}`,
      );
      return {
        case_id: item.case_id,
        domain: item.domain || item.mode || "",
        status: deployment || "EVIDENCE RETAINED",
        outcome: item.observation || "",
        summary: item.mode || "",
        evidence_refs: evidenceRefs,
        tests: (item.tests || []).slice(0, 24).map((test) => `${test.command}: ${test.result}`),
        commit: item.final_head || "",
        deployment,
      };
    });
    const domains = [...new Set(evidenceCases.map((item) => item.domain).filter(Boolean))].slice(0, 32);
    return {
      skill_id: skill.skill_id,
      name: skill.name,
      version: skill.version,
      skill_hash: skill.source_skill_sha256,
      evidence_cases: evidenceCases,
      evaluated_domains: domains,
      failures: (evidence.known_failures || []).slice(0, 32),
      limitations: [evidence.claim_boundary, ...(evidence.limitations || [])].filter(Boolean).slice(0, 32),
      evaluation_context: {
        evaluator: "bounded public Case evidence",
        authority: "evidence review only",
        scope: evidence.claim_boundary || "qualitative candidate evidence",
        independent_evaluation: false,
      },
      provenance: {
        type: "public Skill Forge candidate evidence",
        summary: skill.compatibility?.evidence || "Bounded candidate evidence.",
        public_reference: `https://semeai.tech${skill.evaluation_reference}`,
      },
    };
  }

  function createWorkspaceSkillRow(record) {
    const row = createNode("article", "workspace-skill-record");
    const identity = record?.identity || {};
    const admission = record?.admission || {};
    const head = createNode("div", "workspace-skill-record__head");
    head.append(
      createNode("strong", "", `${identity.name || identity.skill_id || "UNNAMED"} / ${identity.version || "VERSION NOT RETURNED"}`),
      createNode("span", "", admission.state || "REVIEW"),
    );
    const facts = createNode("dl", "workspace-skill-record__facts");
    [
      [t("workspace.skills.fact.cases", "Evidence cases"), record?.evidence?.cases?.length || 0],
      [t("workspace.skills.fact.decision", "Admission decision"), admission.decision || t("workspace.skills.noDecision", "No decision")],
      [t("workspace.skills.fact.availability", "Distribution"), record?.availability?.available ? "AVAILABLE" : "NOT AVAILABLE"],
      [t("workspace.skills.fact.hash", "Method SHA-256"), identity.skill_hash || "NOT RETURNED"],
      [t("workspace.skills.fact.receipt", "Decision receipt"), admission.receipt_id || t("workspace.skills.noReceipt", "No receipt")],
    ].forEach(([term, value]) => {
      const item = createNode("div");
      item.append(createNode("dt", "", term), createNode("dd", "", value));
      facts.append(item);
    });
    row.append(head, facts);
    return row;
  }

  function createCatalogSkillRow(entry, retainedIds, bundle, rerender) {
    const { skill, evidence } = entry;
    const row = createNode("article", "workspace-skill-candidate");
    const copy = createNode("div");
    copy.append(
      createNode("strong", "", `${skill.name} / ${skill.version}`),
      createNode("p", "", skill.compatibility?.evidence || evidence.claim_boundary),
      createNode(
        "small",
        "",
        t("workspace.skills.candidateMeta", "{count} bounded cases · public state {state}", {
          count: evidence.cases?.length || 0,
          state: skill.status || "REVIEW",
        }),
      ),
    );
    const button = createNode(
      "button",
      "product-action product-action--secondary",
      retainedIds.has(skill.skill_id)
        ? t("workspace.skills.retained", "Retained")
        : t("workspace.skills.retain", "Retain evidence"),
    );
    button.type = "button";
    button.disabled = retainedIds.has(skill.skill_id);
    button.addEventListener("click", async () => {
      setBusy(button, true);
      text(byId("workspace-skills-status"), t("workspace.skills.retaining", "Retaining the bounded evidence snapshot…"));
      try {
        const result = await SemeAI.retainWorkspaceSkill(publicSkillPayload(skill, evidence), bundle.token);
        const records = recordsFrom(bundle.skills);
        if (result?.record && !records.some((record) => record.record_id === result.record.record_id)) {
          records.push(result.record);
        }
        bundle.skills = { ...bundle.skills, records, count: records.length, connection: "connected" };
        rerender();
        text(
          byId("workspace-skills-status"),
          result?.created
            ? t("workspace.skills.retainedStatus", "Evidence retained. Retention is not admission.")
            : t("workspace.skills.alreadyRetained", "The same immutable evidence snapshot was already retained."),
        );
      } catch (error) {
        setBusy(button, false);
        text(byId("workspace-skills-status"), errorMessage(error));
      }
    });
    row.append(copy, button);
    return row;
  }

  function initWorkspace() {
    const token = SemeAI.getStoredToken();
    if (!token) {
      location.replace("/account/?return=%2Fworkspace%2F");
      return;
    }

    const loading = byId("workspace-loading");
    const app = byId("workspace-app");
    const alert = byId("workspace-alert");
    let currentBundle = null;
    let publicSkillCatalog = [];
    let publicSkillCatalogError = "";
    let currentView = "overview";
    loading.hidden = false;

    function setView(view, updateHash = true) {
      const valid = [...document.querySelectorAll("[data-workspace-view]")].some((button) => button.dataset.workspaceView === view);
      currentView = valid ? view : "overview";
      let selectedButton = null;
      document.querySelectorAll("[data-workspace-view]").forEach((button) => {
        const selected = button.dataset.workspaceView === currentView;
        if (selected) {
          button.setAttribute("aria-current", "page");
          selectedButton = button;
        }
        else button.removeAttribute("aria-current");
      });
      document.querySelectorAll("[data-workspace-section]").forEach((section) => {
        section.hidden = section.dataset.workspaceSection !== currentView;
      });
      if (updateHash) history.replaceState(null, "", currentView === "overview" ? location.pathname : `${location.pathname}#${currentView}`);
      const nav = selectedButton?.closest(".workspace-nav");
      if (nav && nav.scrollWidth > nav.clientWidth) {
        nav.scrollLeft = Math.max(0, selectedButton.offsetLeft - nav.offsetLeft - 12);
      }
      if (updateHash) byId("workspace-work-area")?.focus?.({ preventScroll: true });
    }

    document.querySelectorAll("[data-workspace-view]").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.workspaceView));
    });

    function renderReceipts(receipts) {
      const list = byId("workspace-receipts-list");
      if (!list) return;
      list.replaceChildren();
      if (!receipts.length) {
        const empty = document.createElement("p");
        empty.className = "workspace-empty";
        empty.textContent = t("workspace.receipts.empty", "No retained receipts were returned by the current workspace API.");
        list.append(empty);
        return;
      }
      receipts.forEach((receipt) => list.append(createReceiptRow(receipt)));
    }

    function renderWorkspaceSkills(bundle) {
      const payload = bundle.skills || {};
      const records = recordsFrom(payload);
      const list = byId("workspace-skills-list");
      const catalog = byId("workspace-skill-catalog");
      list?.replaceChildren();
      catalog?.replaceChildren();

      if (payload.connection !== "connected") {
        text(byId("workspace-skills-status"), t("workspace.skills.unavailable", "Skill persistence is unavailable from the current API deployment."));
      } else {
        text(
          byId("workspace-skills-status"),
          t("workspace.skills.connected", "{count} retained candidate records returned.", { count: records.length }),
        );
      }

      if (list) {
        if (records.length) records.forEach((record) => list.append(createWorkspaceSkillRow(record)));
        else list.append(createNode("p", "workspace-empty", t("workspace.skills.empty", "No skill candidate evidence has been retained in this workspace.")));
      }

      const retainedIds = new Set(records.map((record) => record?.identity?.skill_id).filter(Boolean));
      if (catalog) {
        if (publicSkillCatalog.length) {
          publicSkillCatalog.forEach((entry) =>
            catalog.append(createCatalogSkillRow(entry, retainedIds, bundle, () => renderWorkspaceSkills(bundle))),
          );
        } else {
          catalog.append(
            createNode(
              "p",
              "workspace-empty",
              publicSkillCatalogError || t("workspace.skills.catalogLoading", "Loading bounded public candidates…"),
            ),
          );
        }
      }
      text(
        byId("workspace-context-skills"),
        payload.connection === "connected"
          ? t("workspace.context.skillCount", "{count} retained", { count: records.length })
          : t("workspace.skills.unavailableShort", "Unavailable"),
      );
    }

    function renderWorkspace(bundle) {
      currentBundle = bundle;
      const receipts = receiptsFrom(bundle.receipts);
      const counts = { SHOW: 0, REVIEW: 0, BLOCK: 0 };
      receipts.forEach((receipt) => {
        const action = normalizedAction(receipt);
        if (action) counts[action] += 1;
      });
      const latest = receipts.find((receipt) => normalizedAction(receipt));
      const name = workspaceName(bundle);
      const id = workspaceId(bundle);
      const email = accountEmail(bundle);

      text(byId("workspace-sidebar-name"), name);
      text(byId("workspace-sidebar-id"), id);
      text(byId("workspace-top-identity"), email);
      text(byId("workspace-email"), email);
      text(byId("workspace-plan"), planLabel(bundle));
      text(byId("workspace-billing"), billingLabel(bundle));
      text(byId("workspace-usage"), usageLabel(bundle));
      text(byId("workspace-receipt-count"), receipts.length);
      text(byId("workspace-context-receipts"), t("workspace.context.receiptCount", "{count} returned", { count: receipts.length }));
      text(byId("workspace-show-count"), counts.SHOW);
      text(byId("workspace-review-count"), counts.REVIEW);
      text(byId("workspace-block-count"), counts.BLOCK);
      text(byId("workspace-auth-mode"), bundle.account?.auth_mode || bundle.profile?.auth_mode || t("account.value.unavailable", "Not returned"));

      if (latest) {
        const action = normalizedAction(latest);
        text(byId("workspace-latest-action"), action);
        byId("workspace-latest-action").dataset.action = action;
        text(
          byId("workspace-latest-detail"),
          t("workspace.latest.detail", "{time} · retained receipt {id}", {
            time: formatTimestamp(latest.timestamp),
            id: latest.receipt_id || t("workspace.receipt.idUnavailable", "ID not returned"),
          })
        );
      } else {
        text(byId("workspace-latest-action"), "—");
        byId("workspace-latest-action").removeAttribute("data-action");
        text(byId("workspace-latest-detail"), t("workspace.latest.none", "No retained Gate decision was returned."));
      }

      renderReceipts(receipts);
      renderWorkspaceSkills(bundle);
    }

    function handleWorkspaceError(error) {
      if (error.status === 401 || error.status === 403) {
        SemeAI.clearSession();
        location.replace("/account/?session=expired&return=%2Fworkspace%2F");
        return;
      }
      loading.hidden = true;
      app.hidden = false;
      showMessage(alert, errorMessage(error));
    }

    bindSignOut(byId("workspace-sign-out-top"), alert);
    bindSignOut(byId("workspace-sign-out-settings"), alert);
    window.addEventListener("hashchange", () => setView(location.hash.replace(/^#/, "") || "overview", false));
    window.addEventListener("semeai:lang", () => {
      if (currentBundle) renderWorkspace(currentBundle);
    });

    const initialView = location.hash.replace(/^#/, "") || "overview";
    setView(initialView, false);
    loadPublicSkillCatalog()
      .then((catalog) => {
        publicSkillCatalog = catalog;
        if (currentBundle) renderWorkspaceSkills(currentBundle);
      })
      .catch((error) => {
        publicSkillCatalogError = error.message;
        if (currentBundle) renderWorkspaceSkills(currentBundle);
      });
    loadAccountBundle()
      .then((bundle) => {
        renderWorkspace(bundle);
        loading.hidden = true;
        app.hidden = false;
        setView(currentView, false);
      })
      .catch(handleWorkspaceError);
  }

  if (page === "account") initAccount();
  if (page === "workspace") initWorkspace();
})();
