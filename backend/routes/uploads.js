// server/routes/uploads.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const supabase = require("../supabase"); // server-side supabase client
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

const router = express.Router();

// bucket name
const BUCKET = process.env.SUPABASE_BUCKET || "uploads";

// in-memory storage
const upload = multer({ storage: multer.memoryStorage() });

function makeFilename(originalName) {
  const ext = path.extname(String(originalName || "")).toLowerCase() || ".bin";
  const name = crypto.randomBytes(8).toString("hex");
  return `${Date.now()}-${name}${ext}`;
}

// simple slug for rename
function slugifyName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")            // remove existing extension
    .replace(/[^a-z0-9]+/g, "-")            // non-alphanumeric -> dash
    .replace(/^-+|-+$/g, "") || "file";
}

async function uploadBufferToSupabase(buffer, destPath, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(destPath, buffer, {
    cacheControl: "3600",
    upsert: false,
    contentType: contentType || undefined,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(destPath);
  const publicUrl = data && data.publicUrl ? data.publicUrl : null;
  return { path: destPath, publicUrl };
}

function buildPublicUrl(pathStr) {
  const SUPA_URL =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const bucketName =
    process.env.SUPABASE_BUCKET ||
    process.env.VITE_SUPABASE_PUBLIC_BUCKET ||
    BUCKET;

  if (!SUPA_URL) return null;
  const base = SUPA_URL.replace(/\/+$/, "");
  const normalizedPath = String(pathStr || "").replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${encodeURIComponent(
    bucketName
  )}/${encodeURIComponent(normalizedPath)}`;
}

/**
 * POST /api/uploads
 * Field: file
 * Optional field: folder
 *
 * Behaviour:
 *  - If folder provided, uploads to <folder>/<filename>
 *  - If no folder and file is PDF, uploads to "brochure/<filename>"
 *  - Otherwise uploads to bucket root
 */
router.post(
  "/",
  verifyFirebaseToken,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "No file uploaded (field name: file)" });
      }

      const originalName = req.file.originalname || "file";
      const filename = makeFilename(originalName);
      const mimetype = req.file.mimetype || "application/octet-stream";

      // optional folder from client (for other_documents, etc.)
      let folder = "";
      if (req.body && typeof req.body.folder === "string") {
        folder = req.body.folder.trim().replace(/^\/+|\/+$/g, "");
      }

      const isPdf =
        mimetype === "application/pdf" ||
        path.extname(originalName).toLowerCase() === ".pdf";

      // default folder for PDFs when none explicitly passed
      if (!folder && isPdf) {
        folder = "brochure";
      }

      const destPath = folder ? `${folder}/${filename}` : filename;

      const uploaded = await uploadBufferToSupabase(
        req.file.buffer,
        destPath,
        mimetype
      );

      let publicUrl = uploaded.publicUrl || null;
      if (!publicUrl) {
        publicUrl = buildPublicUrl(uploaded.path);
      }

      return res.json({
        url: publicUrl,
        path: uploaded.path,
        folder: folder || null,
        message: folder
          ? `Uploaded to Supabase folder "${folder}"`
          : "Uploaded to Supabase bucket root",
      });
    } catch (err) {
      console.error("Upload route error:", err);
      return res.status(500).json({ error: "Server error during upload" });
    }
  }
);

/**
 * DELETE /api/uploads
 * Body: { path: "<exact-storage-path>" }
 * Removes a single file from the bucket.
 */
router.delete("/", verifyFirebaseToken, async (req, res) => {
  try {
    const filePath = req.body && req.body.path;
    if (!filePath) {
      return res.status(400).json({ error: "Missing 'path' in request body" });
    }

    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) {
      console.error("Supabase remove error:", error);
      return res.status(500).json({
        error: "Failed to delete file from storage",
        details: error.message || "unknown",
      });
    }

    return res.json({ success: true, path: filePath });
  } catch (err) {
    console.error("Delete route error:", err);
    return res.status(500).json({ error: "Server error during delete" });
  }
});

/**
 * POST /api/uploads/rename
 * Body: { oldPath: "other_documents/xxx.pdf", newName: "Payment Schedule" }
 *
 * Renames the file in the same folder using newName (slugified) + original ext.
 */
router.post("/rename", verifyFirebaseToken, async (req, res) => {
  try {
    const { oldPath, newName } = req.body || {};
    if (!oldPath || !newName) {
      return res
        .status(400)
        .json({ error: "oldPath and newName are required" });
    }

    const folder = path.dirname(oldPath) === "." ? "" : path.dirname(oldPath);
    const ext = path.extname(oldPath) || ".bin";
    const slug = slugifyName(newName);
    const newPath = folder ? `${folder}/${slug}${ext}` : `${slug}${ext}`;

    if (newPath === oldPath) {
      // nothing to do
      const url = buildPublicUrl(oldPath);
      return res.json({
        path: oldPath,
        url,
        name: newName,
        message: "No change in path",
      });
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .move(oldPath, newPath);

    if (error) {
      console.error("Supabase move error:", error);
      return res.status(500).json({
        error: "Failed to rename file in storage",
        details: error.message || "unknown",
      });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(newPath);
    const url = (data && data.publicUrl) || buildPublicUrl(newPath);

    return res.json({
      path: newPath,
      url,
      name: newName,
      message: "File renamed successfully",
    });
  } catch (err) {
    console.error("Rename route error:", err);
    return res.status(500).json({ error: "Server error during rename" });
  }
});

module.exports = router;
