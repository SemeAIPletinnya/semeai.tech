import { createClient } from "/assets/js/supabase-browser.mjs";
import { applyIdentityCopy, language, t } from "/assets/js/identity-i18n.mjs";

if (window.top !== window.self) {
  document.documentElement.replaceChildren();
  throw new Error("SemeAI private identity surfaces cannot run inside a frame.");
}

const SESSION_STORAGE_KEY = "semeai_identity_session";
const ALLOWED_PRIVATE_ROUTES = new Set(["/account/", "/workspace/", "/crm/"]);
const route = document.body?.dataset.identityRoute || "";

export function safeNextPath(value, fallback = "/workspace/") {
  try {
    const parsed = new URL(value || fallback, location.origin);
    const normalized = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
    return parsed.origin === location.origin && ALLOWED_PRIVATE_ROUTES.has(normalized) ? normalized : fallback;
  } catch {
    return fallback;
  }
}

export function providersFromUser(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const direct = identities.map((identity) => String(identity?.provider || "").toLowerCase()).filter(Boolean);
  const metadata = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers.map((provider) => String(provider).toLowerCase())
    : [String(user?.app_metadata?.provider || "").toLowerCase()].filter(Boolean);
  return [...new Set([...direct, ...metadata].filter((provider) => provider === "google" || provider === "github"))];
}

export function publicProfileFromUser(user, profile = null) {
  const metadata = user?.user_metadata || {};
  return {
    id: String(user?.id || ""),
    displayName: profile?.display_name || metadata.full_name || metadata.name || metadata.user_name || "SemeAI user",
    email: profile?.primary_email || user?.email || "Email not returned by provider",
    avatarUrl: profile?.avatar_url || metadata.avatar_url || metadata.picture || "",
    createdAt: profile?.created_at || user?.created_at || "",
    providers: providersFromUser(user),
  };
}

function configured(config) {
  if (window.__SEMEAI_IDENTITY_TEST_CLIENT__) return true;
  if (!config?.enabled || !config.supabaseUrl || !config.supabasePublishableKey) return false;
  try {
    const url = new URL(config.supabaseUrl);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function identityClient(config) {
  if (window.__SEMEAI_IDENTITY_TEST_CLIENT__) return window.__SEMEAI_IDENTITY_TEST_CLIENT__;
  return createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true,
      storage: window.sessionStorage,
      storageKey: SESSION_STORAGE_KEY,
    },
    global: { headers: { "X-Client-Info": "semeai-public-identity-v1" } },
  });
}

function byId(id) { return document.getElementById(id); }

function setText(id, value) {
  const node = byId(id);
  if (node) node.textContent = value || "—";
}

function setRuntimeState(state) {
  document.body.dataset.identityState = state;
  window.SEMEAI_IDENTITY_RUNTIME = Object.freeze({ route, state });
}

function showOnly(ids, visibleId) {
  ids.forEach((id) => {
    const node = byId(id);
    if (node) node.hidden = id !== visibleId;
  });
  setRuntimeState(visibleId.replace(/^identity-|^crm-/, ""));
}

function errorFromLocation() {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const code = query.get("error_code") || query.get("error") || hash.get("error_code") || hash.get("error");
  const description = query.get("error_description") || hash.get("error_description");
  return code || description ? String(description || code).replace(/\+/g, " ") : "";
}

function cleanAuthErrorUrl() {
  if (!history.replaceState) return;
  const next = new URL(location.href);
  ["error", "error_code", "error_description", "error_uri", "code"].forEach((key) => next.searchParams.delete(key));
  next.hash = "";
  history.replaceState(null, "", `${next.pathname}${next.search}`);
}

function formatDate(value, options = { dateStyle: "medium" }) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "—";
  const locale = language() === "uk" ? "uk-UA" : language() === "ru" ? "ru-RU" : "en-GB";
  return new Intl.DateTimeFormat(locale, options).format(date);
}

function providerLabel(provider) {
  return provider === "github" ? "GitHub" : provider === "google" ? "Google" : provider;
}

async function validatedIdentity(client) {
  const sessionResponse = await client.auth.getSession();
  if (sessionResponse?.error) throw sessionResponse.error;
  const session = sessionResponse?.data?.session;
  if (!session) return null;
  const userResponse = await client.auth.getUser();
  if (userResponse?.error || !userResponse?.data?.user) {
    await client.auth.signOut({ scope: "local" }).catch(() => {});
    return null;
  }
  return { session, user: userResponse.data.user };
}

async function profileFor(client, userId) {
  try {
    const result = await client.from("profiles").select("id,display_name,avatar_url,primary_email,created_at").eq("id", userId).maybeSingle();
    return result?.error ? null : result?.data || null;
  } catch {
    return null;
  }
}

function safeImage(node, url, label) {
  if (!node || !url) return;
  try {
    const parsed = new URL(url, location.origin);
    const allowedHost = parsed.origin === location.origin
      || parsed.hostname === "avatars.githubusercontent.com"
      || parsed.hostname === "lh3.googleusercontent.com"
      || parsed.hostname.endsWith(".supabase.co");
    if (!allowedHost || (parsed.protocol !== "https:" && parsed.origin !== location.origin)) return;
    node.src = parsed.href;
    node.alt = label ? `${label} avatar` : "Identity avatar";
    node.hidden = false;
  } catch {}
}

function bindSignOut(client) {
  document.querySelectorAll("[data-identity-sign-out]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      try { await client.auth.signOut({ scope: "local" }); } catch {}
      try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
      location.replace("/account/?signed_out=1");
    });
  });
}

async function initAccount(client) {
  const states = ["identity-restoring", "identity-unconfigured", "identity-error", "identity-signed-out", "identity-signed-in"];
  const providerError = errorFromLocation();
  if (providerError) {
    setText("identity-error-message", providerError);
    showOnly(states, "identity-error");
    cleanAuthErrorUrl();
  }

  document.querySelectorAll("[data-identity-provider]").forEach((button) => {
    button.addEventListener("click", async () => {
      const provider = button.dataset.identityProvider;
      if (provider !== "google" && provider !== "github") return;
      const status = byId("identity-action-status");
      document.querySelectorAll("[data-identity-provider]").forEach((node) => { node.disabled = true; });
      if (status) { status.hidden = false; status.textContent = t("identity.redirecting"); }
      setRuntimeState("redirecting");
      const next = safeNextPath(new URLSearchParams(location.search).get("next"), "/workspace/");
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${location.origin}${next}`, skipBrowserRedirect: Boolean(window.__SEMEAI_IDENTITY_TEST_NO_REDIRECT__) },
      });
      if (error) {
        setText("identity-error-message", error.message || t("identity.error.retry"));
        showOnly(states, "identity-error");
        document.querySelectorAll("[data-identity-provider]").forEach((node) => { node.disabled = false; });
      }
    });
  });

  const identity = await validatedIdentity(client);
  if (!identity) {
    if (!providerError) showOnly(states, "identity-signed-out");
    return;
  }

  const profile = publicProfileFromUser(identity.user, await profileFor(client, identity.user.id));
  setText("identity-display-name", profile.displayName);
  setText("identity-email", profile.email);
  setText("identity-created", formatDate(profile.createdAt));
  setText("identity-providers", profile.providers.map(providerLabel).join(" + ") || "Provider identity");
  safeImage(byId("identity-avatar"), profile.avatarUrl, profile.displayName);
  showOnly(states, "identity-signed-in");
  bindSignOut(client);
}

async function initWorkspace(client) {
  const states = ["identity-restoring", "identity-unconfigured", "identity-error"];
  const providerError = errorFromLocation();
  if (providerError) {
    setText("identity-error-message", providerError);
    showOnly(states, "identity-error");
    cleanAuthErrorUrl();
    return;
  }
  const identity = await validatedIdentity(client);
  if (!identity) {
    location.replace(`/account/?next=${encodeURIComponent("/workspace/")}&reason=auth_required`);
    return;
  }
  const profile = publicProfileFromUser(identity.user, await profileFor(client, identity.user.id));
  setText("workspace-display-name", profile.displayName);
  setText("workspace-email", profile.email);
  setText("workspace-providers", profile.providers.map(providerLabel).join(" + ") || "Provider identity");
  setText("workspace-user-id", profile.id);
  states.forEach((id) => { const node = byId(id); if (node) node.hidden = true; });
  byId("workspace-private").hidden = false;
  setRuntimeState("signed-in");
  bindSignOut(client);
}

function todayKey(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function initials(name, email) {
  return String(name || email || "S").split(/\s+|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function registrationSearchText(record) {
  return [record.display_name, record.primary_email, ...(record.providers || [])].join(" ").toLowerCase();
}

function createRegistrationRow(client, record) {
  const row = document.createElement("article");
  row.className = "crm-row";
  row.dataset.search = registrationSearchText(record);

  const person = document.createElement("div");
  person.className = "crm-person";
  if (record.avatar_url) {
    const avatar = document.createElement("img");
    avatar.loading = "lazy";
    safeImage(avatar, record.avatar_url, record.display_name);
    person.append(avatar);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "crm-avatar-fallback";
    fallback.textContent = initials(record.display_name, record.primary_email);
    person.append(fallback);
  }
  const identity = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = record.display_name || "Unnamed identity";
  const email = document.createElement("small");
  email.textContent = record.primary_email || "Email unavailable";
  identity.append(name, email);
  person.append(identity);

  const providers = document.createElement("div");
  providers.className = "crm-provider-list";
  (record.providers || []).forEach((provider) => {
    const badge = document.createElement("span");
    badge.textContent = providerLabel(provider);
    providers.append(badge);
  });

  const created = document.createElement("time");
  created.dateTime = record.created_at || "";
  created.textContent = formatDate(record.created_at, { dateStyle: "medium", timeStyle: "short" });

  const status = document.createElement("select");
  status.setAttribute("aria-label", `${t("crm.status")}: ${record.display_name || record.primary_email || "identity"}`);
  ["registered", "contacted", "qualified", "archived"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value.toUpperCase();
    option.selected = value === (record.lifecycle_status || "registered");
    status.append(option);
  });

  const noteControl = document.createElement("div");
  noteControl.className = "crm-note-control";
  const note = document.createElement("textarea");
  note.maxLength = 2000;
  note.setAttribute("aria-label", `${t("crm.note")}: ${record.display_name || record.primary_email || "identity"}`);
  note.value = record.owner_note || "";
  const save = document.createElement("button");
  save.className = "crm-save";
  save.type = "button";
  save.textContent = t("crm.save");
  save.addEventListener("click", async () => {
    save.disabled = true;
    save.setAttribute("aria-busy", "true");
    const result = await client.from("registrations").update({ lifecycle_status: status.value, owner_note: note.value.trim() }).eq("user_id", record.user_id);
    save.disabled = false;
    save.removeAttribute("aria-busy");
    if (result?.error) {
      save.textContent = "ERROR";
      return;
    }
    record.lifecycle_status = status.value;
    record.owner_note = note.value.trim();
    save.textContent = t("crm.saved");
    setTimeout(() => { save.textContent = t("crm.save"); }, 1500);
  });
  noteControl.append(note, save);
  row.append(person, providers, created, status, noteControl);
  return row;
}

function renderCrm(client, records) {
  const rows = byId("crm-rows");
  rows.replaceChildren(...records.map((record) => createRegistrationRow(client, record)));
  const today = todayKey(new Date().toISOString());
  setText("crm-total", String(records.length));
  setText("crm-today", String(records.filter((record) => todayKey(record.created_at) === today).length));
  setText("crm-google", String(records.filter((record) => (record.providers || []).includes("google")).length));
  setText("crm-github", String(records.filter((record) => (record.providers || []).includes("github")).length));
  byId("crm-empty").hidden = records.length > 0;
  byId("crm-search")?.addEventListener("input", (event) => {
    const needle = event.currentTarget.value.trim().toLowerCase();
    let shown = 0;
    rows.querySelectorAll(".crm-row").forEach((row) => {
      row.hidden = Boolean(needle) && !row.dataset.search.includes(needle);
      if (!row.hidden) shown += 1;
    });
    byId("crm-empty").hidden = shown > 0;
  });
}

async function initCrm(client) {
  const baseStates = ["identity-restoring", "identity-unconfigured", "identity-error", "crm-denied"];
  const identity = await validatedIdentity(client);
  if (!identity) {
    location.replace(`/account/?next=${encodeURIComponent("/crm/")}&reason=auth_required`);
    return;
  }

  const membership = await client.from("admin_memberships").select("role").eq("user_id", identity.user.id).maybeSingle();
  if (membership?.error || !membership?.data || !["owner", "admin"].includes(membership.data.role)) {
    showOnly(baseStates, "crm-denied");
    return;
  }

  const registrationResult = await client
    .from("registrations")
    .select("user_id,created_at,last_sign_in_at,display_name,primary_email,avatar_url,providers,lifecycle_status,owner_note")
    .order("created_at", { ascending: false });
  if (registrationResult?.error) throw registrationResult.error;

  baseStates.forEach((id) => { const node = byId(id); if (node) node.hidden = true; });
  byId("crm-private").hidden = false;
  setText("crm-owner-email", identity.user.email || "Owner identity");
  renderCrm(client, Array.isArray(registrationResult.data) ? registrationResult.data : []);
  setRuntimeState("owner-authorized");
  bindSignOut(client);
}

async function init() {
  applyIdentityCopy();
  const config = window.SEMEAI_IDENTITY_CONFIG || {};
  if (!configured(config)) {
    if (route !== "account") {
      const requested = route === "crm" ? "/crm/" : "/workspace/";
      location.replace(`/account/?next=${encodeURIComponent(requested)}&reason=identity_configuration`);
      return;
    }
    const states = route === "account"
      ? ["identity-restoring", "identity-unconfigured", "identity-error", "identity-signed-out", "identity-signed-in"]
      : ["identity-restoring", "identity-unconfigured", "identity-error", "crm-denied"];
    showOnly(states, "identity-unconfigured");
    return;
  }

  const client = identityClient(config);
  client.auth.onAuthStateChange?.((event) => {
    if (event === "SIGNED_OUT" && route !== "account") location.replace("/account/?signed_out=1");
  });

  try {
    if (route === "account") await initAccount(client);
    else if (route === "workspace") await initWorkspace(client);
    else if (route === "crm") await initCrm(client);
  } catch (error) {
    setText("identity-error-message", error?.message || t("identity.error.retry"));
    const states = route === "account"
      ? ["identity-restoring", "identity-unconfigured", "identity-error", "identity-signed-out", "identity-signed-in"]
      : ["identity-restoring", "identity-unconfigured", "identity-error", "crm-denied"];
    showOnly(states, "identity-error");
  }
}

if (route) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
}
