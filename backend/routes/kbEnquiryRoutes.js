// server/routes/kbEnquiryRoutes.js
const express = require("express");
const supabase = require("../supabase");

const router = express.Router();

/**
 * POST /api/kb_enquiries
 * Body expected:
 *  - user_id (number)
 *  - type ("bathroom" | "kitchen")
 *  - email, city, area
 *  - bathroom_type (if bathroom)
 *  - kitchen_type, kitchen_theme (if kitchen)
 */
router.post("/", async (req, res) => {
  try {
    const { user_id, type, email, city, area, bathroom_type, kitchen_type, kitchen_theme } = req.body || {};

    if (!user_id || !type) return res.status(400).json({ error: "user_id and type are required" });

    const insertObj = {
      user_id,
      type,
      email: email || null,
      city: city || null,
      area: area ?? null,
      bathroom_type: bathroom_type || null,
      kitchen_type: kitchen_type || null,
      kitchen_theme: kitchen_theme || null,
      // created_at will be set by DB default (if your table has default now())
    };

    const { data, error } = await supabase
      .from("kb_enquiries")
      .insert([insertObj])
      .select()
      .maybeSingle();

    if (error) {
      console.error("Supabase insert kb_enquiries error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    const inserted = data || null;
    return res.status(201).json({ id: inserted?.id ?? null, message: "KB enquiry saved" });
  } catch (err) {
    console.error("POST /api/kb_enquiries unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
