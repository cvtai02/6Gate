// Client-side auth: the login token (a signed session JWT from the API) is kept in
// localStorage and attached to every /api/* request as `Authorization: Bearer <token>`.
//
// NOTE: localStorage tokens are readable by JS (XSS-exposed) — a deliberate trade-off
// vs. an httpOnly cookie. Route protection is therefore client-side (see AuthBootstrap).

const TOKEN_KEY = "6gate_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

let installed = false;

/**
 * Monkey-patch window.fetch once so every same-origin /api/* call carries the bearer
 * token. On a 401 (expired/invalid token) it clears the token and bounces to /login.
 * Scoped tightly: only /api/* URLs are touched, and an existing Authorization header
 * is never overwritten.
 */
export function installAuthFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const orig = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    const isApi =
      url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);

    if (!isApi) return orig(input, init);

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const token = getToken();
    if (token && !headers.has("authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await orig(input, { ...init, headers });

    // Token rejected: drop it and force re-login (but don't loop on the auth endpoints).
    if (res.status === 401 && !url.includes("/api/auth/")) {
      clearToken();
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return res;
  };
}
