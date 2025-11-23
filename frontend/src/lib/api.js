// src/lib/api.js
// NOTE: Vite exposes env vars on import.meta.env (not process.env)
const VITE_BACKEND = import.meta.env.VITE_BACKEND_BASE || "";

// Default dev backend (used when explicitly running locally)
const DEFAULT_DEV_BACKEND = VITE_BACKEND || "http://localhost:5000";

/* -------------------------
   Backend base resolver
   ------------------------- */
function getBackendBase() {
  // Server-side (SSR) or bundling time: return DEFAULT_DEV_BACKEND
  if (typeof window === "undefined") return DEFAULT_DEV_BACKEND;

  // If a build-time backend was provided (VITE_BACKEND), use it in the browser too
  if (VITE_BACKEND) return VITE_BACKEND;

  // Otherwise, detect local dev hostnames
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return DEFAULT_DEV_BACKEND;

  // No explicit backend configured — use empty string so relative URLs point to same origin
  return "";
}
const BASE = getBackendBase();

/* -------------------------
   URL helpers
   ------------------------- */
function looksAbsoluteUrl(s) {
  if (!s) return false;
  const t = String(s).trim();
  if (!t) return false;
  return /^https?:\/\//i.test(t) || /^\/\//.test(t) || t.includes("://");
}

/* -------------------------
   Image helper (getImageUrl)
   - keeps original behaviour: absolute urls returned unchanged
   - absolute path (starts with /) is prefixed with VITE_BACKEND_BASE
   - raw storage path returns as-is (legacy)
   ------------------------- */
export function getImageUrl(pathOrUrl) {
  if (!pathOrUrl) return "";
  const s = String(pathOrUrl).trim();
  if (/^https?:\/\//i.test(s)) return s; // signed/public URL -> return unchanged
  // if it's an absolute path returned by server (e.g., '/uploads/xyz.jpg'), prefix backend base
  const BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || "";
  if (s.startsWith("/")) return `${BACKEND_BASE}${s}`;
  // if it's a raw storage path like 'projects/abc.jpg', return as-is (client should call server to get signed URL)
  return s;
}

/* -------------------------
   Auth helpers + fetch wrappers
   ------------------------- */

export function getAuthToken() {
  try {
    return localStorage.getItem("auth_token") || null;
  } catch (e) {
    console.warn("getAuthToken error", e);
    return null;
  }
}

export async function sendWithAuth(rawPathOrUrl, opts = {}) {
  const url = looksAbsoluteUrl(rawPathOrUrl)
    ? rawPathOrUrl
    : `${BASE}${rawPathOrUrl.startsWith("/") ? "" : "/"}${rawPathOrUrl}`;

  const token = getAuthToken();
  const headers = new Headers(opts.headers || {});

  if (!headers.has("Content-Type") && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...opts, headers, credentials: "include" });

  const text = await response.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }

  if (response.status === 401 || response.status === 403) {
    const err = new Error("Unauthorized");
    err.status = response.status;
    err.body = data;
    throw err;
  }

  return { ok: response.ok, status: response.status, data };
}

export async function apiFetch(path, opts = {}) {
  return sendWithAuth(path, opts);
}

export default { getImageUrl, getAuthToken, sendWithAuth, apiFetch };

/* -------------------------
   New helpers for signed URLs & blob fetching
   ------------------------- */

/**
 * Ask your backend for a signed URL for `storagePath`.
 * Backend endpoint expected: GET /api/signed-url?path=<storagePath>&expires=<seconds>
 * Response expected: { url: "<signedUrl>", expires: <seconds> } (or { url: "<signedUrl>" })
 */
export async function getSignedUrlFromServer(storagePath, expires = 60) {
  if (!storagePath) throw new Error("storagePath required");
  // If storagePath is already absolute, just return it
  if (looksAbsoluteUrl(storagePath)) return { url: storagePath, expires: null };

  // Use sendWithAuth so token is applied if your endpoint requires auth
  const q = `?path=${encodeURIComponent(storagePath)}&expires=${encodeURIComponent(
    String(expires)
  )}`;
  const res = await sendWithAuth(`/api/signed-url${q}`, { method: "GET" });
  if (!res.ok) {
    const err = new Error("Failed to get signed url");
    err.body = res.data;
    err.status = res.status;
    throw err;
  }
  // allow backend flexibility: it might return { url } or { signedUrl } etc.
  const payload = res.data || {};
  const url = payload.url || payload.signedUrl || payload.signed_url || null;
  const ttl = payload.expires || payload.ttl || null;
  if (!url) {
    const err = new Error("signed url not returned by server");
    err.body = payload;
    throw err;
  }
  return { url, expires: ttl };
}

/**
 * Fetches the image as a blob (via signed url) and returns a stable object URL.
 * Useful if you want image to keep displaying after the signed url expires.
 * Caller must revoke the returned objectUrl with URL.revokeObjectURL when done.
 */
export async function fetchImageBlobObjectUrl(signedUrl) {
  if (!looksAbsoluteUrl(signedUrl)) throw new Error("signedUrl must be absolute");
  const resp = await fetch(signedUrl, { method: "GET" });
  if (!resp.ok) {
    const err = new Error(`Failed to fetch image blob (${resp.status})`);
    err.status = resp.status;
    throw err;
  }
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  return objectUrl;
}

/**
 * High level helper for the app to resolve an image preview.
 * - storagePath can be:
 *   - an absolute signed/public URL -> returned as-is
 *   - a server absolute path like '/uploads/x.jpg' -> prefixed using VITE_BACKEND_BASE (getImageUrl handles this)
 *   - a raw storage path like 'projects/a.jpg' -> request signed URL from server
 *
 * options:
 *  - useBlob: if true, this will fetch the image blob and return an objectURL (stable after signed url expiry)
 *  - expires: requested signed url TTL (seconds) when calling backend
 *
 * Returns: { src: string, expires: number|null, from: "absolute"|"signed"|"blob" }
 */
export async function resolveImagePreview(storagePathOrUrl, options = {}) {
  const { useBlob = false, expires = 60 } = options;
  if (!storagePathOrUrl) return { src: "", expires: null, from: null };

  // 1) already an absolute url -> return unchanged
  if (looksAbsoluteUrl(storagePathOrUrl)) {
    return { src: storagePathOrUrl, expires: null, from: "absolute" };
  }

  // 2) If server returned absolute path like '/uploads/..' -> prefix and return
  const maybePrefixed = getImageUrl(storagePathOrUrl);
  if (looksAbsoluteUrl(maybePrefixed)) {
    return { src: maybePrefixed, expires: null, from: "absolute" };
  }

  // 3) treat as raw storage path -> ask backend for signed url
  const { url, expires: serverTtl = null } = await getSignedUrlFromServer(storagePathOrUrl, expires);

  if (!useBlob) {
    return { src: url, expires: serverTtl, from: "signed" };
  }

  // 4) use blob method to keep the image around after url expiry
  const objectUrl = await fetchImageBlobObjectUrl(url);
  return { src: objectUrl, expires: serverTtl, from: "blob" };
}
