// Token storage + login/logout helpers. Token is kept in localStorage so a
// hard reload survives. The api.js wrapper attaches it as Bearer on every
// request and emits an `auth-changed` window event whenever it flips.

const KEY = "recodex.auth";

export function getAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(value) {
  if (value) {
    localStorage.setItem(KEY, JSON.stringify(value));
  } else {
    localStorage.removeItem(KEY);
  }
  window.dispatchEvent(new Event("recodex:auth-changed"));
}

export function getToken() {
  return getAuth()?.token ?? null;
}

export function logout() {
  setAuth(null);
}
