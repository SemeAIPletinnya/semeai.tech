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
    const [account, usage, receipts, billing] = await Promise.all([
      SemeAI.account(token),
      SemeAI.usage(token).catch(() => null),
      SemeAI.receipts(token, 100).catch(() => ({ receipts: [] })),
      SemeAI.billingStatus(token).catch(() => null),
    ]);
    return { token, profile: profile || {}, account, usage, receipts, billing };
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
    let currentView = "overview";
    loading.hidden = false;

    function setView(view, updateHash = true) {
      const valid = [...document.querySelectorAll("[data-workspace-view]")].some((button) => button.dataset.workspaceView === view);
      currentView = valid ? view : "overview";
      document.querySelectorAll("[data-workspace-view]").forEach((button) => {
        const selected = button.dataset.workspaceView === currentView;
        if (selected) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
      document.querySelectorAll("[data-workspace-section]").forEach((section) => {
        section.hidden = section.dataset.workspaceSection !== currentView;
      });
      if (updateHash) history.replaceState(null, "", currentView === "overview" ? location.pathname : `${location.pathname}#${currentView}`);
      byId("workspace-work-area")?.focus?.({ preventScroll: true });
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
    loadAccountBundle()
      .then((bundle) => {
        renderWorkspace(bundle);
        loading.hidden = true;
        app.hidden = false;
      })
      .catch(handleWorkspaceError);
  }

  if (page === "account") initAccount();
  if (page === "workspace") initWorkspace();
})();
