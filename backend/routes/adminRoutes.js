// backend/routes/admins.js
const express = require("express");
const supabase = require("../supabase"); // must export createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken"); // MUST exist
const requireAdmin = require("../middleware/requireAdmin"); // optional, used below

const router = express.Router();

// Protect all routes with token verification
router.use(verifyFirebaseToken);

/** Helper - normalize phone (store digits or E.164 if + included) */
function normalizePhone(phone) {
  if (!phone) return null;
  const s = String(phone).trim();
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/** Helper - normalize email */
function normalizeEmail(email) {
  if (!email) return null;
  return String(email).trim().toLowerCase();
}

/**
 * GET /api/admins
 * Returns: { items: [ { id, name, phone, email, created_at } ] }
 *
 * Protected: requireAdmin middleware applied (only admins can list admins)
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("admin")
      .select("id, name, phone, email, created_at")
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
 * body: { phone: string (optional), email: string (required), name?: string }
 * Creates or upserts an admin record. Email is required by your schema.
 *
 * Returns: { admin: { id, name, phone, email, created_at } }
 *
 * Protected: requireAdmin (only existing admins can add new admins).
 */
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { phone: rawPhone, name, email: rawEmail } = req.body || {};
    const email = normalizeEmail(rawEmail);

    if (!email) return res.status(400).json({ error: "email required" });

    const phone = normalizePhone(rawPhone);

    // Build payload according to your admin table
    const payload = {
      email,
      phone: phone || null,
      name: name || null,
    };

    // Upsert on email OR phone? Your table has unique constraint only on phone.
    // We'll upsert by phone if provided, else insert new record (email not unique).
    // Use returning representation to get the inserted/updated record.
    let result;
    if (phone) {
      // upsert by phone
      result = await supabase
        .from("admin")
        .upsert(payload, { onConflict: "phone", returning: "representation" })
        .select("id, name, phone, email, created_at");
    } else {
      // phone not provided: insert new row (email must be provided)
      result = await supabase
        .from("admin")
        .insert([payload])
        .select("id, name, phone, email, created_at");
    }

    const { data, error } = result;
    if (error) {
      console.error("POST /api/admins supabase error:", error);
      // handle unique/constraint-ish errors generically
      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return res.status(409).json({ error: "Admin with this phone/email already exists" });
      }
      return res.status(500).json({ error: "DB error" });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return res.status(201).json({ admin: row });
  } catch (e) {
    console.error("POST /api/admins unexpected error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/admins/:id
 * body: { phone?: string, name?: string, email?: string }
 * Update admin record's phone/name/email.
 *
 * Protected: requireAdmin
 */
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { phone: rawPhone, name, email: rawEmail } = req.body || {};
    if (!id) return res.status(400).json({ error: "id required" });

    const updates = {};
    if (rawPhone !== undefined) updates.phone = normalizePhone(rawPhone);
    if (name !== undefined) updates.name = name || null;
    if (rawEmail !== undefined) updates.email = normalizeEmail(rawEmail) || null;

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "nothing to update" });

    const { data, error } = await supabase
      .from("admin")
      .update(updates)
      .eq("id", id)
      .select("id, name, phone, email, created_at");

    if (error) {
      console.error("PUT /api/admins/:id supabase error:", error);
      // conflict on phone will surface as error from supabase
      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return res.status(409).json({ error: "phone or email already exists" });
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
 *
 * Protected: requireAdmin
 */
router.delete("/:id", requireAdmin, async (req, res) => {
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

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admins/:id unexpected error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/admins/ensure-user
 * Body: { name?: string, phone?: string, email?: string }
 *
 * Behavior:
 * - Require phone or email
 * - Check admin table for matching phone OR email
 * - If not admin -> 403
 * - If admin:
 *    - If a users row exists for the phone OR email -> return it with isAdmin: true
 *    - Otherwise insert a users row (name, phone, email) and return it with isAdmin: true
 *
 * Protected: requireAdmin (only callers who are admin themselves can call this endpoint)
 */
// POST /api/admin/ensure-user
// NOTE: this route expects verifyFirebaseToken middleware to have already run.
//       Do NOT protect it with requireAdmin (so users can check themselves).
router.post("/ensure-user", async (req, res) => {
  try {
    const { name: bodyName, email: rawEmail } = req.body || {};

    const email = rawEmail ? String(rawEmail).trim().toLowerCase() : null;
    const name = bodyName ? String(bodyName).trim() : null;

    if (!email) return res.status(400).json({ error: "Email required" });

    // 1) Check admin table for matching email only
    let adminRow = null;
    try {
      const { data, error } = await supabase
        .from("admin")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.error("admin lookup error (email):", error);
        return res.status(500).json({ error: "DB error" });
      }
      adminRow = data;
    } catch (e) {
      console.error("Error querying admin table:", e);
      return res.status(500).json({ error: "DB error" });
    }

    if (!adminRow) {
      // Not an admin — reject
      return res.status(403).json({ error: "Not an admin" });
    }

    // preferred values (prefer admin table values)
    const preferredName = name || adminRow.name || null;
    const preferredEmail = email || (adminRow.email ? String(adminRow.email).trim().toLowerCase() : null);

    // 2) Find existing users row by email only
    let userRow = null;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", preferredEmail)
        .maybeSingle();

      if (error) {
        console.error("users lookup error (email):", error);
        return res.status(500).json({ error: "DB error" });
      }
      userRow = data;
    } catch (e) {
      console.error("Error querying users table:", e);
      return res.status(500).json({ error: "DB error" });
    }

    const respondWithUser = (user) => {
      const u = {
        id: user.id,
        uid: user.uid || null,
        name: user.name || preferredName,
        phone: user.phone || null,
        email: user.email || preferredEmail,
        isAdmin: true,
      };
      return res.json({ user: u });
    };

    if (userRow) {
      return respondWithUser(userRow);
    }

    // 3) No users row found -> insert it (email unique in users table)
    const toInsert = {
      name: preferredName,
      email: preferredEmail,
      phone: null,
    };

    try {
      const { data: insertedRow, error: insertErr } = await supabase
        .from("users")
        .insert([toInsert])
        .select()
        .maybeSingle();

      if (insertErr) {
        console.error("users insert error:", insertErr);
        const msg = (insertErr?.message || "").toLowerCase();
        if (msg.includes("unique") || msg.includes("duplicate")) {
          return res.status(409).json({ error: "Email already exists" });
        }
        return res.status(500).json({ error: "DB error" });
      }

      const finalInserted = insertedRow || { id: null, ...toInsert };
      return respondWithUser(finalInserted);
    } catch (e) {
      console.error("Unexpected insert error:", e);
      return res.status(500).json({ error: "DB error" });
    }
  } catch (e) {
    console.error("POST /api/admin/ensure-user unexpected error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
