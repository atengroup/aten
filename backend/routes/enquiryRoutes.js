// server/routes/homeEnquiries.js
const express = require("express");
const supabase = require("../supabase");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const {
      user_id,
      email,
      city,
      type,
      bathroom_number,
      kitchen_type,
      material,
      area,
      theme,
    } = req.body || {};

    if (!user_id || !email || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const insertObj = {
      user_id,
      email,
      city: city || null,
      type,
      bathroom_number: bathroom_number || null,
      kitchen_type: kitchen_type || null,
      material: material || null,
      area: area || null,
      theme: theme || null,
    };

    // Insert row and return the inserted record
    const { data, error } = await supabase
      .from("home_enquiries")
      .insert([insertObj])
      .select()
      .maybeSingle();

    if (error) {
      console.error("Supabase insert home_enquiries error:", error);
      return res.status(500).json({ error: "Database insert failed" });
    }

    const inserted = data || null;
    return res.status(201).json({
      message: "Enquiry saved successfully",
      enquiry_id: inserted?.id ?? null,
    });
  } catch (err) {
    console.error("POST /home_enquiries error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
