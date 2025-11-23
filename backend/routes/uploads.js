// server/routes/uploads.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const supabase = require("../supabase");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

const router = express.Router();

// change this to your bucket name if different
const BUCKET = "uploads";

// use memory storage so we can upload buffer directly to Supabase
const upload = multer({ storage: multer.memoryStorage() });

// small helper to generate a short random filename preserving extension
function makeFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const name = crypto.randomBytes(8).toString("hex");
  return `${Date.now()}-${name}${ext}`;
}

// upload buffer to Supabase storage and return { path, publicUrl }
async function uploadBufferToSupabase(buffer, destPath) {
  const { error } = await supabase.storage.from(BUCKET).upload(destPath, buffer, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(destPath);
  return { path: destPath, publicUrl: data?.publicUrl || null };
}

/**
 * POST /api/uploads
 * Accepts single file field "file".
 * Returns: { path: "<bucket/path>", publicUrl: "https://..." }
 */
router.post("/", verifyFirebaseToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field name: file)" });

    const filename = makeFilename(req.file.originalname);
    // optional: store files under a folder, e.g., `users/<uid>/...` or `projects/...`
    const prefix = req.firebaseUser?.uid ? `users/${req.firebaseUser.uid}` : "uploads";
    const destPath = `${prefix}/${filename}`;

    // upload buffer
    try {
      const uploaded = await uploadBufferToSupabase(req.file.buffer, destPath);
      return res.json({
        path: uploaded.path,
        publicUrl: uploaded.publicUrl,
        message: "Uploaded to Supabase storage",
      });
    } catch (uploadErr) {
      console.error("Supabase upload error:", uploadErr);
      return res.status(500).json({ error: "Failed to upload to storage", details: uploadErr.message || uploadErr });
    }
  } catch (err) {
    console.error("Upload route error:", err);
    return res.status(500).json({ error: "Server error during upload" });
  }
});

module.exports = router;
