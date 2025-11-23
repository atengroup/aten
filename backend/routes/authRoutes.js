// backend/routes/authRoutes.js
const express = require("express");
const supabase = require("../supabase");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

const router = express.Router();

/**
 * POST /auth
 * Expects verifyFirebaseToken middleware to set req.firebaseUser with fields:
 *  - uid
 *  - phone_number
 *  - name (optional)
 */
router.post("/", verifyFirebaseToken, async (req, res) => {
  try {
    const firebaseUser = req.firebaseUser || {};
    const uid = firebaseUser.uid;
    const phone = firebaseUser.phone_number || null;
    const name = firebaseUser.name || req.body.name || null;

    if (!uid) {
      return res.status(400).json({ error: "No uid in token" });
    }

    // helper: check admin by phone (returns boolean)
    const checkAdmin = async () => {
      if (!phone) return false;
      const { data: adminRow, error: adminErr } = await supabase
        .from("admin")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (adminErr) throw adminErr;
      return !!adminRow;
    };

    // helper: finish response (keeps same shape as original)
    const finishResponse = (user, isAdmin) => {
      return res.json({
        success: true,
        user: {
          id: user.id,
          uid: user.uid,
          phone: user.phone,
          name: user.name || null,
          isAdmin: !!isAdmin,
        },
      });
    };

    // 1) Try find user by uid first
    const { data: userRowByUid, error: findByUidErr } = await supabase
      .from("users")
      .select("*")
      .eq("uid", uid)
      .maybeSingle();

    if (findByUidErr) {
      console.error("Supabase error finding user by uid:", findByUidErr);
      return res.status(500).json({ error: "Database error" });
    }

    if (userRowByUid) {
      // Ensure uid stored (defensive) - if it's missing, update
      if (!userRowByUid.uid) {
        try {
          const { data: updatedRows, error: updateErr } = await supabase
            .from("users")
            .update({ uid })
            .eq("id", userRowByUid.id)
            .select()
            .maybeSingle();

          if (updateErr) console.warn("Failed to update uid on existing user:", updateErr);
          const isAdmin = await checkAdmin().catch((e) => {
            console.error("checkAdmin error:", e);
            throw e;
          });
          return finishResponse({ ...userRowByUid, uid }, isAdmin);
        } catch (e) {
          console.error("Error updating uid on existing user:", e);
          return res.status(500).json({ error: "Database error" });
        }
      } else {
        // uid already present
        const isAdmin = await checkAdmin().catch((e) => {
          console.error("checkAdmin error:", e);
          throw e;
        });
        return finishResponse(userRowByUid, isAdmin);
      }
    }

    // 2) No user by uid: try find by phone (if phone exists)
    if (phone) {
      const { data: userByPhone, error: findByPhoneErr } = await supabase
        .from("users")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

      if (findByPhoneErr) {
        console.error("Supabase error finding user by phone:", findByPhoneErr);
        return res.status(500).json({ error: "Database error" });
      }

      if (userByPhone) {
        // Update this row to add uid and possibly name (COALESCE-like behavior)
        try {
          const updatePayload = { uid };
          if (name) updatePayload.name = name; // overwrite only if we have a provided name

          const { data: updatedUser, error: updateErr } = await supabase
            .from("users")
            .update(updatePayload)
            .eq("id", userByPhone.id)
            .select()
            .maybeSingle();

          if (updateErr) console.warn("Failed to update uid on userByPhone:", updateErr);

          const isAdmin = await checkAdmin().catch((e) => {
            console.error("checkAdmin error:", e);
            throw e;
          });

          // prefer the updatedUser if available, otherwise merge
          const resultUser = updatedUser || { ...userByPhone, uid, name: userByPhone.name || name };
          return finishResponse(resultUser, isAdmin);
        } catch (e) {
          console.error("Error updating userByPhone:", e);
          return res.status(500).json({ error: "Database error" });
        }
      } else {
        // Create a new user row (phone available, not found)
        try {
          const insertObj = { uid, name, phone };
          const { data: inserted, error: insertErr } = await supabase
            .from("users")
            .insert([insertObj])
            .select()
            .maybeSingle();

          if (insertErr) {
            console.error("Supabase error inserting user:", insertErr);
            return res.status(500).json({ error: "Database error" });
          }

          const newUser = inserted || { id: null, uid, name, phone };
          const isAdmin = await checkAdmin().catch((e) => {
            console.error("checkAdmin error:", e);
            throw e;
          });
          return finishResponse(newUser, isAdmin);
        } catch (e) {
          console.error("Error inserting new user (phone):", e);
          return res.status(500).json({ error: "Database error" });
        }
      }
    } else {
      // 3) phone not available and no existing user by uid — create user with uid only
      try {
        const insertObj = { uid, name, phone: null };
        const { data: inserted, error: insertErr } = await supabase
          .from("users")
          .insert([insertObj])
          .select()
          .maybeSingle();

        if (insertErr) {
          console.error("Supabase error inserting user (no phone):", insertErr);
          return res.status(500).json({ error: "Database error" });
        }

        const newUser = inserted || { id: null, uid, name, phone: null };
        const isAdmin = await checkAdmin().catch((e) => {
          console.error("checkAdmin error:", e);
          throw e;
        });
        return finishResponse(newUser, isAdmin);
      } catch (e) {
        console.error("Error inserting new user (no phone):", e);
        return res.status(500).json({ error: "Database error" });
      }
    }
  } catch (err) {
    console.error("/auth error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
