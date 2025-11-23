// server/routes/uploads.js
const express = require("express");
const supabase = require("../supabase");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

const router = express.Router();
const BUCKET = "uploads";      // change if needed
const SIGN_EXPIRES = 300;     // seconds for signed URLs (5 minutes)
const IMAGE_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg",
]);

function isImageName(name) {
  if (!name || typeof name !== "string") return false;
  const idx = name.lastIndexOf(".");
  if (idx === -1) return false;
  const ext = name.slice(idx).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

/**
 * GET /api/uploads
 * Returns: [{ path, name, signedUrl }, ...]
 * Signed URLs expire after SIGN_EXPIRES seconds.
 */
router.get("/", verifyFirebaseToken, async (req, res) => {
  try {
    const collected = [];
    let offset = 0;
    const pageSize = 500;

    while (true) {
      const { data, error } = await supabase.storage.from(BUCKET).list("", {
        limit: pageSize,
        offset,
      });

      if (error) {
        console.error("Supabase storage list error:", error);
        return res.status(500).json({ error: "Failed to list uploads" });
      }
      if (!data || data.length === 0) break;

      for (const item of data) {
        // skip folders; only process files that look like images
        if (item.type && item.type !== "file") continue;
        if (!isImageName(item.name)) continue;

        const pathInBucket = item.name; // if you store in subfolders, this includes the path
        // create signed URL
        const { data: signedData, error: signErr } = await supabase
          .storage
          .from(BUCKET)
          .createSignedUrl(pathInBucket, SIGN_EXPIRES);

        if (signErr) {
          console.warn("Failed to create signed URL for", pathInBucket, signErr);
          // fallback: try public URL (will be unusable if bucket is private), but include path for debugging
          const { data: pubData } = supabase.storage.from(BUCKET).getPublicUrl(pathInBucket);
          collected.push({
            path: pathInBucket,
            name: item.name,
            signedUrl: signedData?.signedUrl || pubData?.publicUrl || null,
            signedUrlError: signErr.message || String(signErr),
          });
        } else {
          collected.push({
            path: pathInBucket,
            name: item.name,
            signedUrl: signedData.signedUrl,
          });
        }
      }

      if (data.length < pageSize) break;
      offset += pageSize;
    }

    return res.json(collected);
  } catch (err) {
    console.error("Uploads listing error:", err);
    return res.status(500).json({ error: "Server error while listing uploads" });
  }
});

module.exports = router;
