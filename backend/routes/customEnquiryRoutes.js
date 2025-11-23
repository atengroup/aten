// server/routes/customEnquiryRoutes.js
const express = require("express");
const supabase = require("../supabase");
const router = express.Router();

/**
 * POST /api/custom_enquiries
 * Body: { user_id, type, email, city, area, message | custom_message }
 */
router.post("/", async (req, res) => {
  try {
    const { user_id, type, email, city, area } = req.body;
    const message = req.body.message ?? req.body.custom_message ?? null;

    if (!user_id)
      return res.status(400).json({ error: "user_id is required" });

    const insertData = {
      user_id,
      type: type || null,
      email: email || null,
      city: city || null,
      area: area || null,
      message,
    };

    const { data, error } = await supabase
      .from("custom_enquiries")
      .insert([insertData])
      .select()
      .maybeSingle();

    if (error) {
      console.error("Supabase insert custom_enquiries error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res
      .status(201)
      .json({ id: data?.id, message: "Custom enquiry saved" });
  } catch (err) {
    console.error("Unexpected error in POST /api/custom_enquiries:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
