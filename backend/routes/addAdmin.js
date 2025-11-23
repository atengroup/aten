// backend/routes/admins.js
const express = require("express");
const supabase = require("../supabase"); // should export createClient(...) instance
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken"); // MUST exist

const router = express.Router();

// Protect all admin routes
router.use(verifyFirebaseToken);

/** Helper - normalize phone (store digits or E.164 if + included) */
function normalizePhone(phone) {
  if (!phone) return "";
  const s = String(phone).trim();
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * GET /api/admins
 * Returns: { items: [ { id, name, phone, created_at } ] }
 */
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("admin")
      .select("id, name, phone, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/admins supabase error:", error);
      return res.status(500).json({ error: "DB error" });
    }
    res.json({ items: data || [] });
  } catch (e) {
    console.error("GET /api/admins unexpected error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/admins
 * body: { phone: string (required), name?: string }
 * Creates a new admin record (or updates existing). Idempotent-ish.
 */
router.post("/", async (req, res) => {
  try {
    const { phone: rawPhone, name } = req.body || {};
    if (!rawPhone) return res.status(400).json({ error: "phone required" });

    const phone = normalizePhone(rawPhone);

    // Use upsert on phone (phone is unique)
    const payload = { phone, name: name || null };

    const { data, error } = await supabase
      .from("admin")
      .upsert(payload, { onConflict: "phone", returning: "representation" })
      .select("id, name, phone, created_at");

    if (error) {
      console.error("POST /api/admins supabase error:", error);
      // handle unique/constraint-ish errors generically
      return res.status(500).json({ error: "DB error" });
    }

    // upsert returns an array of rows; pick the first
    const row = Array.isArray(data) ? data[0] : data;
    return res.status(201).json({ admin: row });
  } catch (e) {
    console.error("POST /api/admins unexpected error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/admins/:id
 * body: { phone?: string, name?: string }
 * Update admin record's phone or name. (Phone must remain unique)
 */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { phone: rawPhone, name } = req.body || {};
    if (!id) return res.status(400).json({ error: "id required" });

    const updates = {};
    if (rawPhone !== undefined) updates.phone = normalizePhone(rawPhone);
    if (name !== undefined) updates.name = name || null;

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "nothing to update" });

    const { data, error } = await supabase
      .from("admin")
      .update(updates)
      .eq("id", id)
      .select("id, name, phone, created_at");

    if (error) {
      console.error("PUT /api/admins/:id supabase error:", error);
      // conflict on phone will surface as error from supabase
      if (error.code === "23505" || error.message?.includes("duplicate") ) {
        return res.status(409).json({ error: "phone already exists" });
      }
      return res.status(500).json({ error: "DB error" });
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ admin: row });
  } catch (e) {
    console.error("PUT /api/admins/:id unexpected error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/admins/:id
 * Remove admin (demote)
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });

    const { data, error } = await supabase
      .from("admin")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("DELETE /api/admins/:id supabase error:", error);
      return res.status(500).json({ error: "DB error" });
    }

    // data is array of deleted rows
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admins/:id unexpected error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
