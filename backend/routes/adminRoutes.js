// backend/routes/adminRoutes.js
const express = require("express");
const supabase = require("../supabase"); // must export createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

router.use(verifyFirebaseToken);
router.use(requireAdmin);

/** Helper - normalize phone (store digits or E.164 if + included) */
function normalizePhone(phone) {
  if (!phone) return "";
  const s = String(phone).trim();
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * POST /api/auth/admin
 * Body: { name, phone }
 *
 * Behavior:
 * - Check admin table for phone
 * - If not admin -> 403
 * - If admin: if a users row exists for the phone -> return it with isAdmin: true
 *   otherwise insert a users row and return that
 */
router.post("/admin", async (req, res) => {
  try {
    const { name, phone: rawPhone } = req.body || {};
    if (!rawPhone) return res.status(400).json({ error: "Phone required" });

    const phone = normalizePhone(rawPhone);

    // Check admin table by phone
    const { data: adminRow, error: adminErr } = await supabase
      .from("admin")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (adminErr) {
      console.error("Supabase admin lookup error:", adminErr);
      return res.status(500).json({ error: "DB error" });
    }

    if (!adminRow) {
      // Not an admin — reject
      return res.status(403).json({ error: "Not an admin" });
    }

    // Check if users row exists
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (userErr) {
      console.error("Supabase users lookup error:", userErr);
      return res.status(500).json({ error: "DB error" });
    }

    const respondWithUser = (user) => {
      const u = {
        id: user.id,
        name: user.name || name || adminRow.name,
        phone: user.phone,
        isAdmin: true,
      };
      return res.json({ user: u });
    };

    if (userRow) {
      return respondWithUser(userRow);
    }

    // Insert a new user
    const toInsert = {
      name: name || adminRow.name || null,
      phone,
    };

    const { data: insertedRows, error: insertErr } = await supabase
      .from("users")
      .insert([toInsert])
      .select()
      .maybeSingle();

    if (insertErr) {
      console.error("Supabase users insert error:", insertErr);
      return res.status(500).json({ error: "DB error" });
    }

    // insertedRows may be single row or null if something odd happened
    const newUser = insertedRows || { id: null, name: toInsert.name, phone };
    return respondWithUser(newUser);
  } catch (e) {
    console.error("POST /api/auth/admin unexpected error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
