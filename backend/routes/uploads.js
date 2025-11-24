// server/routes/uploads.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const supabase = require("../supabase"); // ensure this is your server-side supabase client initialized with service role or server key
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

const router = express.Router();

// bucket name
const BUCKET = process.env.SUPABASE_BUCKET || "uploads";

// store files at the root of the bucket (destPath = filename)
const upload = multer({ storage: multer.memoryStorage() });

function makeFilename(originalName) {
  const ext = path.extname(String(originalName || "")).toLowerCase() || ".jpg";
  const name = crypto.randomBytes(8).toString("hex");
  return `${Date.now()}-${name}${ext}`;
}

async function uploadBufferToSupabase(buffer, destPath) {
  const { error } = await supabase.storage.from(BUCKET).upload(destPath, buffer, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    // Supabase error object may include status/message
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(destPath);
  const publicUrl = data && data.publicUrl ? data.publicUrl : null;

  return { path: destPath, publicUrl };
}

/**
 * POST /api/uploads
 * Accepts single file field "file".
 * Returns: { url: "<publicUrl>", path: "<filename>" }
 */
router.post("/", verifyFirebaseToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (field name: file)" });
    }

    const filename = makeFilename(req.file.originalname);

    // store at bucket root: destPath = filename
    const destPath = filename;

    try {
      const uploaded = await uploadBufferToSupabase(req.file.buffer, destPath);

      // fallback: build public url from env if supabase didn't return one
      let publicUrl = uploaded.publicUrl || null;
      if (!publicUrl) {
        const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
        const bucketName = process.env.SUPABASE_BUCKET || process.env.VITE_SUPABASE_PUBLIC_BUCKET || BUCKET;
        if (SUPA_URL) {
          const base = SUPA_URL.replace(/\/+$/, "");
          const normalizedPath = String(uploaded.path || "").replace(/^\/+/, "");
          publicUrl = `${base}/storage/v1/object/public/${encodeURIComponent(bucketName)}/${encodeURIComponent(normalizedPath)}`;
        }
      }

      return res.json({
        url: publicUrl,
        path: uploaded.path,
        message: "Uploaded to Supabase bucket root",
      });
    } catch (uploadErr) {
      console.error("Supabase upload error:", uploadErr);
      return res.status(500).json({
        error: "Failed to upload to storage",
        details: uploadErr && uploadErr.message ? String(uploadErr.message) : "unknown",
      });
    }
  } catch (err) {
    console.error("Upload route error:", err);
    return res.status(500).json({ error: "Server error during upload" });
  }
});

module.exports = router;
