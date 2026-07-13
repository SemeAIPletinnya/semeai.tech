(() => {
  const API_BASE = window.SEMEAI_API_BASE || "https://api.semeai.tech";

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

  window.SemeAI = {
    API_BASE,
    health: () => request("/health"),
    status: () => request("/v0/status"),
    demoAccount: () => request("/v0/demo/account"),
    register: (payload) => request("/v0/register", { method: "POST", body: payload }),
    verify: (token) => request("/v0/verify", { method: "POST", body: { verification_token: token } }),
    account: (apiKey) => request("/v0/account", { token: apiKey }),
    usage: (apiKey) => request("/v0/usage", { token: apiKey }),
    keys: (apiKey) => request("/v0/keys", { token: apiKey }),
    rotateKey: (apiKey, label = "rotated") =>
      request("/v0/keys/rotate", { method: "POST", token: apiKey, body: { label } }),
    revokeKey: (apiKey, fingerprint) =>
      request("/v0/keys/revoke", { method: "POST", token: apiKey, body: { fingerprint } }),
    receipts: (apiKey, limit = 25) => request(`/v0/receipts?limit=${limit}`, { token: apiKey }),
    receipt: (apiKey, id) => request(`/v0/receipts/${encodeURIComponent(id)}`, { token: apiKey }),
    billingStatus: (apiKey) => request("/v0/billing/status", { token: apiKey }),
    billingIntent: (apiKey, payload) =>
      request("/v0/billing/manual-crypto-intent", { method: "POST", token: apiKey, body: payload }),
    billingTxid: (apiKey, payload) =>
      request("/v0/billing/submit-txid", { method: "POST", token: apiKey, body: payload }),
    check: (apiKey, payload) => request("/v0/check", { method: "POST", token: apiKey, body: payload }),
    demoCheck: (payload) => request("/v0/demo/check", { method: "POST", body: payload }),
  };
})();
