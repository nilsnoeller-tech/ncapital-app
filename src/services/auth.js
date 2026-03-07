// ─── Auth Service ───
// Magic-Link-basierte Authentifizierung gegen den Cloudflare Worker.

const PROXY_BASE = "https://ncapital-market-proxy.nils-noeller.workers.dev";
const TOKEN_KEY = "ncapital-jwt";

// ─── Token Management ───

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (parts[1].length % 4)) % 4)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      logout();
      return null;
    }
    return { username: payload.sub };
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return getUser() !== null;
}

// ─── Magic Link API Calls ───

export async function requestMagicLink(email) {
  const resp = await fetch(`${PROXY_BASE}/api/auth/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Magic Link konnte nicht gesendet werden");
  return data;
}

export async function verifyMagicToken(token) {
  const resp = await fetch(`${PROXY_BASE}/api/auth/verify-magic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Token ungueltig oder abgelaufen");
  setToken(data.token);
  return data;
}

// ─── Authenticated Fetch Wrapper ───

export async function authFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    throw new AuthError("Nicht eingeloggt");
  }

  const headers = { ...options.headers };
  headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(url, { ...options, headers });

  if (resp.status === 401) {
    logout();
    window.dispatchEvent(new Event("ncapital-auth-error"));
    throw new AuthError("Sitzung abgelaufen");
  }

  return resp;
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}
