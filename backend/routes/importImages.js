// server/routes/uploads.js
const express = require("express");
const multer = require("multer");
const AdmZip = require("adm-zip");
const crypto = require("crypto");
const supabase = require("../supabase");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

const router = express.Router();

// name of the Supabase Storage bucket to use
const BUCKET = "uploads";

// allowed image extensions inside ZIP or as uploaded files
const IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
]);

// Use memory storage so we can upload buffers directly to Supabase
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Helper: returns a short unique filename preserving extension
 */
function makeFilename(ext = "") {
  const basename = crypto.randomBytes(8).toString("hex");
  return `${basename}${ext}`;
}

/**
 * Helper: create public url for an uploaded file path in bucket
 */
function publicUrlFor(pathInBucket) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(pathInBucket);
  return data?.publicUrl || null;
}

/**
 * POST /api/uploads
 * Accepts either:
 *  - single image file field named "file" (existing behavior), or
 *  - a zip file field named "images_zip" containing multiple images.
 *
 * Returns JSON:
 *  { uploaded: [{ path, publicUrl }], message: "..." }
 */
router.post(
  "/",
  verifyFirebaseToken,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "images_zip", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const saved = [];

      // 1) Handle regular single-file uploads (field name "file")
      if (req.files && req.files.file && req.files.file.length) {
        for (const f of req.files.file) {
          const originalExt = (f.originalname && f.originalname.includes("."))
            ? f.originalname.slice(f.originalname.lastIndexOf(".")).toLowerCase()
            : "";
          const ext = IMAGE_EXTS.has(originalExt) ? originalExt : "";
          const destName = makeFilename(ext || ".jpg");
          const pathInBucket = destName; // top-level, you can add folders like `images/${destName}`

          // upload buffer
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(pathInBucket, f.buffer, { cacheControl: "3600", upsert: false });

          if (upErr) {
            console.error("Supabase upload error (file):", upErr);
            return res.status(500).json({ error: "Failed to upload file to storage" });
          }

          const publicUrl = publicUrlFor(pathInBucket);
          saved.push({ path: pathInBucket, publicUrl });
        }
      }

      // 2) Handle ZIP upload (field "images_zip")
      if (req.files && req.files.images_zip && req.files.images_zip.length) {
        const zipFile = req.files.images_zip[0];
        // read ZIP from buffer
        const zip = new AdmZip(zipFile.buffer);
        const entries = zip.getEntries();

        for (const entry of entries) {
          if (entry.isDirectory) continue;
          const entryName = entry.entryName; // may include folders
          const ext = entryName.includes(".")
            ? entryName.slice(entryName.lastIndexOf(".")).toLowerCase()
            : "";
          if (!IMAGE_EXTS.has(ext)) {
            // skip non-image files silently
            continue;
          }

          const outName = makeFilename(ext);
          const pathInBucket = outName;

          const buffer = entry.getData(); // Buffer
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(pathInBucket, buffer, { cacheControl: "3600", upsert: false });

          if (upErr) {
            console.error("Supabase upload error (zip entry):", upErr);
            // continue to next file instead of failing entire ZIP; you can change to fail-fast
            continue;
          }

          const publicUrl = publicUrlFor(pathInBucket);
          saved.push({ path: pathInBucket, publicUrl });
        }
      }

      if (saved.length === 0) {
        return res.status(400).json({
          error:
            "No images found in upload (supported: jpg, jpeg, png, webp, gif, bmp, svg)",
        });
      }

      return res.json({
        uploaded: saved,
        message: `Saved ${saved.length} image(s) to Supabase storage.`,
      });
    } catch (err) {
      console.error("Upload route error:", err);
      return res.status(500).json({ error: "Upload failed" });
    }
  }
);

module.exports = router;
