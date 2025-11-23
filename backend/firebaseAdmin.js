// backend/firebaseAdmin.js
require('dotenv').config();         // <-- ensure .env is loaded BEFORE reading process.env
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const LOCAL_KEY_PATH = path.join(__dirname, "firebase-service-account.json");

// Try to get the service account from an environment variable first.
// The env var may contain:
// 1) the raw JSON text string (single-line or multi-line),
// 2) a base64-encoded JSON string,
// 3) OR it might be a filesystem path (legacy behavior) — we still support that.
const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;

function parseServiceAccountFromEnv(rawString) {
  if (!rawString) return null;

  // Trim surrounding whitespace and any accidental surrounding quotes
  const s = rawString.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

  // 1) If it looks like a JSON object, try JSON.parse directly
  if (s.startsWith('{')) {
    try {
      return JSON.parse(s);
    } catch (err) {
      // fallthrough to try base64 decode
    }
  }

  // 2) If it looks like base64 (rough heuristic: only base64 chars and reasonably long), try decode
  const base64Regex = /^[A-Za-z0-9+/=\s]+$/;
  if (base64Regex.test(s) && s.length > 100) {
    try {
      const decoded = Buffer.from(s, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (err) {
      // fallthrough to try path
    }
  }

  // 3) Otherwise treat it as a path
  // Support absolute or relative paths
  try {
    const possiblePath = path.isAbsolute(s) ? s : path.join(process.cwd(), s);
    if (fs.existsSync(possiblePath)) {
      // require the JSON file
      return require(possiblePath);
    }
  } catch (err) {
    // ignore and return null below
  }

  // If nothing worked, return null to let the caller fallback or throw.
  return null;
}

let serviceAccount = parseServiceAccountFromEnv(raw);

// If env parsing failed, fallback to local file if it exists
if (!serviceAccount) {
  if (fs.existsSync(LOCAL_KEY_PATH)) {
    try {
      serviceAccount = require(LOCAL_KEY_PATH);
    } catch (err) {
      console.error("Failed to require local firebase-service-account.json:", err);
    }
  }
}

if (!admin.apps.length) {
  if (!serviceAccount) {
    // Helpful error to diagnose in logs — do NOT leak actual secret JSON here.
    console.error(
      "Firebase service account not found. Set GOOGLE_APPLICATION_CREDENTIALS to:\n" +
      "  - the full service account JSON string (properly escaped), OR\n" +
      "  - a base64-encoded JSON string, OR\n" +
      "  - a path to the JSON file. \n" +
      `Local fallback path checked: ${LOCAL_KEY_PATH}`
    );

    // Throw so the app fails fast instead of silently running without credentials.
    throw new Error("Firebase service account not provided via GOOGLE_APPLICATION_CREDENTIALS and local file not found.");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
