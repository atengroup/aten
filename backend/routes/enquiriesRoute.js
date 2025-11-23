// server/routes/enquiriesRoutes.js
const express = require("express");
const supabase = require("../supabase");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

const router = express.Router();

// protect all routes
router.use(verifyFirebaseToken);

// Helper: normalize phone by removing non-digits
function normalizeDigits(s) {
  if (!s && s !== 0) return null;
  return String(s).replace(/\D/g, "");
}

// Map TABLE_MAP for metadata (table name + editable fields)
const TABLE_MAP = {
  home: {
    table: "home_enquiries",
    editable: [
      "user_id",
      "email",
      "city",
      "type",
      "bathroom_number",
      "kitchen_type",
      "material",
      "area",
      "theme",
    ],
  },
  custom: {
    table: "custom_enquiries",
    editable: ["user_id", "email", "type", "city", "area", "message"],
  },
  kb: {
    table: "kb_enquiries",
    editable: [
      "user_id",
      "email",
      "type",
      "city",
      "area",
      "bathroom_type",
      "kitchen_type",
      "kitchen_theme",
    ],
  },
  // NEW: wardrobe enquiries support
  wardrobe: {
    table: "wardrobe_enquiries",
    editable: [
      "user_id",
      "email",
      "type",
      "city",
      "length",
      "wardrobe_type",
      "material",
      "finish",
    ],
  },
};

// Helper: map a raw Supabase row into expected output fields based on tableKey
function mapRowToOutput(tableKey, row) {
  // row contains fields of enquiry and a nested users object when selected with users(...)
  const users = row.users || row.user || null; // handle possible naming
  return {
    enquiry_id: row.id,
    user_id: row.user_id ?? null,
    name: users?.name ?? null,
    user_phone: users?.phone ?? null,
    email: row.email ?? null,
    city: row.city ?? null,
    type: row.type ?? null,
    bathroom_number: row.bathroom_number ?? null,
    kitchen_type: row.kitchen_type ?? null,
    material: row.material ?? null,
    area: row.area ?? null,
    theme: row.theme ?? null,
    message: row.message ?? null,
    bathroom_type: row.bathroom_type ?? null,
    kitchen_theme: row.kitchen_theme ?? null,
    // WARDROBE-specific fields
    length: row.length ?? null,
    wardrobe_type: row.wardrobe_type ?? null,
    finish: row.finish ?? null,
    created_at: row.created_at ?? null,
    // keep raw row attached for debugging if needed
    _raw: row,
    table: tableKey,
  };
}

/**
 * GET /api/enquiries?table=home|custom|kb|wardrobe
 * Returns JSON { items: [ ...rows ] }.
 */
router.get("/", async (req, res) => {
  try {
    const tableKey = (req.query.table || "").trim();
    if (!tableKey || !TABLE_MAP[tableKey]) {
      return res
        .status(400)
        .json({ error: "Invalid or missing table. Use home|custom|kb|wardrobe" });
    }

    const table = TABLE_MAP[tableKey].table;

    // select enquiry fields + nested users (left join)
    // use users(name, phone) to fetch user info
    const { data, error } = await supabase
      .from(table)
      .select("*, users(name, phone)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/enquiries supabase error:", error);
      return res.status(500).json({ error: "server error" });
    }

    const annotated = (data || []).map((r) => mapRowToOutput(tableKey, r));
    return res.json({ items: annotated });
  } catch (err) {
    console.error("GET /api/enquiries error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

/**
 * GET /api/enquiries/related?user_id=... | ?phone=... | ?email=...
 * Returns { items: [ ... ] } from all tables (deduped)
 */
router.get("/related", async (req, res) => {
  try {
    const { user_id, phone, email } = req.query;
    if (!user_id && !phone && !email) {
      return res
        .status(400)
        .json({ error: "Provide user_id or phone or email as query params" });
    }

    const normPhone = phone ? normalizeDigits(phone) : null;
    const normEmail = email ? String(email).trim().toLowerCase() : null;

    // If phone provided, find matching user ids by normalizing stored user.phone
    let matchedUserIds = null;
    if (normPhone) {
      const { data: usersList, error: usersErr } = await supabase
        .from("users")
        .select("id, phone");
      if (usersErr) {
        console.error("Error fetching users for phone match:", usersErr);
        return res.status(500).json({ error: "server error" });
      }
      matchedUserIds = (usersList || [])
        .filter((u) => {
          const stored = normalizeDigits(u.phone);
          return stored && stored === normPhone;
        })
        .map((u) => u.id);
    }

    // Helper to query a specific enquiries tableKey with identifiers
    async function queryTableFor(tableKey) {
      const table = TABLE_MAP[tableKey].table;

      // Build supabase query
      // We'll try to use server-side filters where possible:
      // - If user_id provided => eq('user_id', user_id)
      // - Else if matchedUserIds (from phone) => in('user_id', matchedUserIds)
      // - Else if normEmail provided => use or() to match e.email or users.email
      let query = supabase.from(table).select("*, users(name, phone)").order("created_at", { ascending: false });

      if (user_id) {
        query = query.eq("user_id", user_id);
      } else if (normPhone) {
        if (matchedUserIds.length === 0) {
          // no matching users, return empty
          return [];
        }
        query = query.in("user_id", matchedUserIds);
      } else if (normEmail) {
        // use or to match either enquiry.email or users.email
        // PostgREST expects or filter like: or=(email.eq.value,users.email.eq.value)
        // supabase-js supports .or() method; note: value must be URL-encoded by library
        const orExpr = `email.eq.${normEmail},users.email.eq.${normEmail}`;
        query = query.or(orExpr);
      }

      const { data: rows, error } = await query;
      if (error) {
        // If or() used and fails for some reason, fallback to fetching all and filtering client-side
        console.error(`Query error for ${table}:`, error);
        throw error;
      }
      return rows || [];
    }

    // Run queries for all tables in TABLE_MAP
    const keys = Object.keys(TABLE_MAP);
    const resultsByTable = await Promise.all(keys.map((k) => queryTableFor(k)));

    // Tag each row with table and map to expected fields
    const tagged = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const rows = resultsByTable[i] || [];
      for (const r of rows) {
        tagged.push(mapRowToOutput(k, r));
      }
    }

    // dedupe (by table + enquiry_id)
    const seen = new Set();
    const unique = [];
    for (const r of tagged) {
      const key = `${r.table}-${r.enquiry_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    }

    return res.json({ items: unique });
  } catch (err) {
    console.error("GET /api/enquiries/related error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

/**
 * PUT /api/enquiries/:table/:id
 * Update allowed columns for a given enquiry
 */
router.put("/:table/:id", async (req, res) => {
  try {
    const tableKey = (req.params.table || "").trim();
    const id = req.params.id;
    if (!TABLE_MAP[tableKey]) return res.status(400).json({ error: "Invalid table" });

    const editable = TABLE_MAP[tableKey].editable || [];
    const payload = req.body || {};

    // Build update object only from editable fields
    const updateObj = {};
    for (const field of editable) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        updateObj[field] = payload[field];
      }
    }

    if (Object.keys(updateObj).length === 0) {
      return res.status(400).json({ error: "No editable fields provided" });
    }

    const table = TABLE_MAP[tableKey].table;
    const { data: updatedRows, error } = await supabase
      .from(table)
      .update(updateObj)
      .eq("id", id)
      .select("*, users(name, phone)")
      .maybeSingle();

    if (error) {
      console.error("PUT /api/enquiries supabase error:", error);
      return res.status(500).json({ error: "update failed" });
    }

    if (!updatedRows) {
      return res.status(404).json({ error: "Enquiry not found or nothing changed" });
    }

    const updated = mapRowToOutput(tableKey, updatedRows);
    return res.json({ updated });
  } catch (err) {
    console.error("PUT /api/enquiries/:table/:id error:", err);
    return res.status(500).json({ error: "update failed" });
  }
});

/**
 * DELETE /api/enquiries/:table/:id
 */
router.delete("/:table/:id", async (req, res) => {
  try {
    const tableKey = (req.params.table || "").trim();
    const id = req.params.id;
    if (!TABLE_MAP[tableKey]) return res.status(400).json({ error: "Invalid table" });

    const table = TABLE_MAP[tableKey].table;
    const { data, error } = await supabase.from(table).delete().eq("id", id).select("id");

    if (error) {
      console.error("DELETE /api/enquiries supabase error:", error);
      return res.status(500).json({ error: "delete failed" });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /api/enquiries/:table/:id error:", err);
    return res.status(500).json({ error: "delete failed" });
  }
});

module.exports = router;
