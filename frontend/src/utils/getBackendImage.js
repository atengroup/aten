// utils/getBackendImage.js
// Works with Vite env vars + local dev fallback

export function resolveImageUrl(raw) {
  if (!raw) return null;

  // use Vite env var for backend base (baked in at build time)
  const VITE_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || "";

  // fallback to localhost in dev
  const backend =
    VITE_BACKEND_BASE ||
    (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
      ? "http://localhost:5000"
      : "");

  // absolute URLs (http/https) stay as they are
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  // backend-hosted image paths
  if (raw.startsWith("/uploads")) {
    return backend + raw;
  }

  // plain filenames
  return backend + "/uploads/" + raw.replace(/^\/+/, "");
}

export default resolveImageUrl;
