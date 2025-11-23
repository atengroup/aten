// backend/middleware/requireAdmin.js
const supabase = require("../supabase");

async function requireAdmin(req, res, next) {
  // ensure token verified first
  if (!req.firebaseUser) return res.status(401).json({ error: "Not authenticated" });

  const phone = req.firebaseUser.phone_number;
  if (!phone) return res.status(403).json({ error: "No phone number" });

  try {
    const { data: row, error } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      console.error("Supabase error checking admin:", error);
      return res.status(500).json({ error: "DB error" });
    }

    if (!row) return res.status(403).json({ error: "User not found" });

    // Accept both boolean true and numeric 1 for legacy rows
    const isAdmin =
      row.isAdmin === true ||
      row.isAdmin === 1 ||
      row.is_admin === true ||
      row.is_admin === 1; // in case column name differs

    if (!isAdmin) {
      return res.status(403).json({ error: "Admin only" });
    }

    // attach DB user to request
    req.user = row;
    next();
  } catch (e) {
    console.error("Unexpected error checking admin:", e);
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = requireAdmin;
