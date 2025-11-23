// server/routes/uploadTestimonialImage.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const supabase = require("../supabase");

const router = express.Router();
// Use memory storage so we can upload buffer to Supabase
const upload = multer({ storage: multer.memoryStorage() });

const BUCKET = "uploads"; // adjust if your bucket name differs
const SIGNED_URL_TTL = 60 * 60 * 24; // 24 hours - adjust as needed

function generateFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const rand = crypto.randomBytes(8).toString("hex");
  return `testimonial-${Date.now()}-${rand}${ext}`;
}

/**
 * POST /api/upload-testimonial-image
 * Field name: image
 * Returns: { path, publicUrl, signedUrl, message }
 */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (field: image)" });
    }

    const filename = generateFilename(req.file.originalname);

    // optional: namespace by user if firebase user is present (you may have middleware that sets req.firebaseUser)
    const prefix = req.firebaseUser?.uid ? `testimonials/${req.firebaseUser.uid}` : `testimonials/general`;
    const filePath = `${prefix}/${filename}`;

    // Upload buffer to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, req.file.buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: req.file.mimetype || "application/octet-stream",
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res.status(500).json({ error: "Upload failed", details: uploadError.message || uploadError });
    }

    // Get public URL (will work if bucket or object is public)
    let publicUrl = null;
    try {
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      publicUrl = publicData && publicData.publicUrl ? publicData.publicUrl : null;
    } catch (err) {
      // non-fatal
      console.warn("getPublicUrl failed:", err);
    }

    // Create a signed URL for immediate preview (works for private or public buckets)
    let signedUrl = null;
    try {
      const { data: signedData, error: signedErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_TTL);
      if (!signedErr && signedData && signedData.signedUrl) signedUrl = signedData.signedUrl;
    } catch (err) {
      console.warn("createSignedUrl failed:", err);
    }

    // Respond with canonical path (store this in DB) and immediate preview URL(s)
    return res.json({
      path: filePath,        // store this in DB (non-expiring reference)
      publicUrl,            // null if bucket is private
      signedUrl,            // expiring preview URL (good for immediate preview)
      message: "Uploaded successfully",
    });
  } catch (err) {
    console.error("Upload testimonial image error:", err);
    return res.status(500).json({ error: "Server error", details: err?.message || err });
  }
});

module.exports = router;
