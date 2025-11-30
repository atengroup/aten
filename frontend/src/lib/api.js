// src/lib/api.js
import { getAuth } from "firebase/auth";

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
   Public Supabase storage helpers & blob fetching
   ------------------------- */

/**
 * Build a public Supabase storage URL (if env vars present)
 * Expects:
 *  - VITE_SUPABASE_URL e.g., "https://abcd1234.supabase.co"
 *  - VITE_SUPABASE_PUBLIC_BUCKET e.g., "uploads" or "public"
 *
 * Returns absolute url if possible, otherwise null.
 */
function getPublicStorageUrl(storagePath) {
  if (!storagePath) return null;

  const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "";
  const SUPA_BUCKET = import.meta.env.VITE_SUPABASE_PUBLIC_BUCKET || "";

  // normalize storagePath: remove any leading slashes
  const normalized = String(storagePath).replace(/^\/+/, "");

  if (SUPA_URL && SUPA_BUCKET) {
    // ensure no trailing slash on SUPA_URL
    const base = SUPA_URL.replace(/\/+$/, "");
    // If the storagePath already contains the bucket (e.g., "uploads/..." ), avoid duplicating
    // but our expected storagePath is the path *inside* the bucket e.g., "testimonials/abc.jpg"
    // If the user stored "uploads/..." and the bucket is "uploads", remove the bucket duplicate.
    const bucketSegment = SUPA_BUCKET.replace(/^\/+|\/+$/g, "");
    let finalPath = normalized;
    if (normalized.startsWith(`${bucketSegment}/`)) {
      finalPath = normalized.slice(bucketSegment.length + 1);
    }
    return `${base}/storage/v1/object/public/${encodeURIComponent(bucketSegment)}/${finalPath}`;
  }

  // env not configured -> cannot build public url here
  return null;
}

/**
 * Fetches the image as a blob (via signed url/public url) and returns a stable object URL.
 * Useful if you want image to keep displaying after a (signed) url expires.
 * Caller must revoke the returned objectUrl with URL.revokeObjectURL when done.
 */
export async function fetchImageBlobObjectUrl(signedOrPublicUrl) {
  if (!looksAbsoluteUrl(signedOrPublicUrl)) throw new Error("signedOrPublicUrl must be absolute");
  const resp = await fetch(signedOrPublicUrl, { method: "GET" });
  if (!resp.ok) {
    const err = new Error(`Failed to fetch image blob (${resp.status})`);
    err.status = resp.status;
    throw err;
  }
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  return objectUrl;
}

/* -------------------------
   Image helper (getImageUrl)
   - absolute urls returned unchanged
   - root-relative public assets (e.g. /bedroom1.jpg) returned unchanged (so frontend serves them)
   - server/storage paths (e.g. /uploads/..., /storage/v1/...) are prefixed with BACKEND_BASE
   - raw storage path 'uploads/...' will try to be converted to public Supabase URL via getPublicStorageUrl()
   ------------------------- */

export function getImageUrl(pathOrUrl) {
  if (!pathOrUrl) return "";
  const s = String(pathOrUrl).trim();
  // already absolute
  if (/^https?:\/\//i.test(s)) return s;

  const BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || "";

  // If starts with slash, decide if this is a server/storage path or a public-front asset
  if (s.startsWith("/")) {
    // Treat only known server/storage prefixes as server-managed paths which should be prefixed
    const serverPrefixes = ["/uploads/", "/storage/", "/storage/v1/", "/api/uploads/", "/api/signed-url/"];
    const lower = s.toLowerCase();
    const isServerPath = serverPrefixes.some((pref) => lower.startsWith(pref.toLowerCase()));

    if (isServerPath) {
      // Prefix with backend base (may be empty string) so these resolve to your backend/supabase endpoints
      return `${BACKEND_BASE}${s}`;
    }

    // Otherwise treat as a public/root asset and return unchanged (so it loads from frontend's public/)
    return s;
  }

  // Not starting with slash; could be a raw storage path like "uploads/abc.jpg"
  try {
    const pub = getPublicStorageUrl(s);
    if (pub) return pub;
  } catch (e) {
    // ignore and fallthrough
  }

  // fallback: return as-is (may be relative path)
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
/* -------------------------
   Firebase token refresh helper
   ------------------------- */

async function refreshAuthToken() {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.warn("No Firebase user for token refresh");
      return null;
    }

    // force refresh from Firebase
    const newToken = await user.getIdToken(true);
    try {
      localStorage.setItem("auth_token", newToken);
    } catch (e) {
      console.warn("Failed to store new auth_token", e);
    }
    return newToken;
  } catch (err) {
    console.error("refreshAuthToken failed", err);
    return null;
  }
}

export async function sendWithAuth(rawPathOrUrl, opts = {}, _internalRetry = false) {
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

  // Read response body once
  const text = await response.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }

  // If unauthorized and we haven't retried yet -> try refresh + retry
  if ((response.status === 401 || response.status === 403) && !_internalRetry) {
    const newToken = await refreshAuthToken();
    if (newToken) {
      const retryHeaders = new Headers(opts.headers || {});
      if (!retryHeaders.has("Content-Type") && !(opts.body instanceof FormData)) {
        retryHeaders.set("Content-Type", "application/json");
      }
      retryHeaders.set("Authorization", `Bearer ${newToken}`);

      const retryResp = await fetch(url, { ...opts, headers: retryHeaders, credentials: "include" });
      const retryText = await retryResp.text().catch(() => "");
      let retryData = null;
      try {
        retryData = retryText ? JSON.parse(retryText) : null;
      } catch (e) {
        retryData = retryText;
      }

      if (retryResp.status === 401 || retryResp.status === 403) {
        const err = new Error("Unauthorized");
        err.status = retryResp.status;
        err.body = retryData;
        throw err;
      }

      return { ok: retryResp.ok, status: retryResp.status, data: retryData };
    }

    // refresh failed – fall through to error
    const err = new Error("Unauthorized");
    err.status = response.status;
    err.body = data;
    throw err;
  }

  // no retry path needed, return or throw as before
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
   Remaining helpers that use getPublicStorageUrl/getSignedUrlFromServer
   ------------------------- */

/**
 * Ask your backend for a signed URL for `storagePath`.
 * Kept for backward compatibility in case env vars are not set.
 * Backend endpoint expected: GET /api/signed-url?path=<storagePath>&expires=<seconds>
 * Response expected: { url: "<signedUrl>", expires: <seconds> } (or { url: "<signedUrl>" })
 */
export async function getSignedUrlFromServer(storagePath, expires = 60) {
  if (!storagePath) throw new Error("storagePath required");
  // If storagePath is already absolute, just return it
  if (looksAbsoluteUrl(storagePath)) return { url: storagePath, expires: null };

  // FIRST: try to build public Supabase URL (if env vars present)
  const publicUrl = getPublicStorageUrl(storagePath);
  if (publicUrl) {
    // return as an absolute public url (no ttl)
    return { url: publicUrl, expires: null };
  }

  // FALLBACK: use sendWithAuth so token is applied if your endpoint requires auth
  const q = `?path=${encodeURIComponent(storagePath)}&expires=${encodeURIComponent(String(expires))}`;
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
 * High level helper for the app to resolve an image preview.
 * - storagePath can be:
 *   - an absolute signed/public URL -> returned as-is
 *   - a server absolute path like '/uploads/x.jpg' -> prefixed using VITE_BACKEND_BASE (getImageUrl handles this)
 *   - a raw storage path like 'uploads/testimonials/a.jpg' or 'testimonials/a.jpg' -> converted to public Supabase url (if VITE_SUPABASE_... envs present)
 *
 * options:
 *  - useBlob: if true, this will fetch the image blob and return an objectURL (stable after url expiry)
 *  - expires: requested signed url TTL (seconds) when calling backend (used only if env vars missing and signed url fallback is used)
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

  // 3) Try to create a public Supabase storage URL (preferred for public buckets)
  const publicUrl = getPublicStorageUrl(storagePathOrUrl);
  if (publicUrl) {
    if (!useBlob) {
      return { src: publicUrl, expires: null, from: "absolute" };
    }
    const objectUrl = await fetchImageBlobObjectUrl(publicUrl);
    return { src: objectUrl, expires: null, from: "blob" };
  }

  // 4) FALLBACK: treat as raw storage path -> ask backend for signed url (kept for compatibility)
  const { url, expires: serverTtl = null } = await getSignedUrlFromServer(storagePathOrUrl, expires);

  if (!useBlob) {
    return { src: url, expires: serverTtl, from: "signed" };
  }

  // 5) use blob method to keep the image around after url expiry
  const objectUrl = await fetchImageBlobObjectUrl(url);
  return { src: objectUrl, expires: serverTtl, from: "blob" };
}
