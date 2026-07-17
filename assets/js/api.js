(() => {
  const API_BASE = window.SEMEAI_API_BASE || "https://api.semeai.tech";
  const SESSION_KEY = "semeai_session_token";
  const LEGACY_KEY = "semeai_dashboard_api_key";

  async function request(path, { method = "GET", body, token } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(data.error || data.detail || res.statusText || "Request failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function getStoredToken() {
    return (
      sessionStorage.getItem(SESSION_KEY) ||
      sessionStorage.getItem(LEGACY_KEY) ||
      localStorage.getItem(SESSION_KEY) ||
      ""
    ).trim();
  }

  function setSessionToken(token, { remember = false } = {}) {
    if (!token) return;
    sessionStorage.setItem(SESSION_KEY, token);
    sessionStorage.setItem(LEGACY_KEY, token); // backward-compatible cabinet code
    if (remember) localStorage.setItem(SESSION_KEY, token);
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  window.SemeAI = {
    API_BASE,
    SESSION_KEY,
    getStoredToken,
    setSessionToken,
    clearSession,
    health: () => request("/health"),
    status: () => request("/v0/status"),
    demoAccount: () => request("/v0/demo/account"),
    register: (payload) => request("/v0/register", { method: "POST", body: payload }),
    verify: (token) => request("/v0/verify", { method: "POST", body: { verification_token: token } }),
    login: (payload) => request("/v0/login", { method: "POST", body: payload }),
    logout: (token) =>
      request("/v0/logout", {
        method: "POST",
        token: token || getStoredToken(),
        body: {},
      }),
    account: (apiKey) => request("/v0/account", { token: apiKey || getStoredToken() }),
    usage: (apiKey) => request("/v0/usage", { token: apiKey || getStoredToken() }),
    keys: (apiKey) => request("/v0/keys", { token: apiKey || getStoredToken() }),
    rotateKey: (apiKey, label = "rotated") =>
      request("/v0/keys/rotate", {
        method: "POST",
        token: apiKey || getStoredToken(),
        body: { label },
      }),
    revokeKey: (apiKey, fingerprint) =>
      request("/v0/keys/revoke", {
        method: "POST",
        token: apiKey || getStoredToken(),
        body: { fingerprint },
      }),
    receipts: (apiKey, limit = 25) =>
      request(`/v0/receipts?limit=${limit}`, { token: apiKey || getStoredToken() }),
    receipt: (apiKey, id) =>
      request(`/v0/receipts/${encodeURIComponent(id)}`, { token: apiKey || getStoredToken() }),
    billingStatus: (apiKey) => request("/v0/billing/status", { token: apiKey || getStoredToken() }),
    billingIntent: (apiKey, payload) =>
      request("/v0/billing/manual-crypto-intent", {
        method: "POST",
        token: apiKey || getStoredToken(),
        body: payload,
      }),
    billingTxid: (apiKey, payload) =>
      request("/v0/billing/submit-txid", {
        method: "POST",
        token: apiKey || getStoredToken(),
        body: payload,
      }),
    check: (apiKey, payload) =>
      request("/v0/check", {
        method: "POST",
        token: apiKey || getStoredToken(),
        body: payload,
      }),
    demoCheck: (payload) => request("/v0/demo/check", { method: "POST", body: payload }),
  };
})();
