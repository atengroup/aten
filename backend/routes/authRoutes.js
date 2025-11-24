// backend/routes/authRoutes.js
const express = require("express");
const supabase = require("../supabase");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

const router = express.Router();

/**
 * POST /auth
 * verifyFirebaseToken should set req.firebaseUser with fields like:
 *  - uid
 *  - phone_number (optional)
 *  - email (optional)
 *  - name (optional)
 *
 * Additionally we accept phone/email/name in req.body as fallback (client-supplied).
 */
router.post("/", verifyFirebaseToken, async (req, res) => {
  try {
    const firebaseUser = req.firebaseUser || {};
    const uid = firebaseUser.uid;
    // token values take precedence; fall back to body values
    const phone = firebaseUser.phone_number || req.body.phone || null;
    const email = firebaseUser.email || req.body.email || null;
    const name = firebaseUser.name || req.body.name || null;

    if (!uid) {
      return res.status(400).json({ error: "No uid in token" });
    }

    // helper: check admin by phone (returns boolean)
    const checkAdmin = async (phoneToCheck) => {
      if (!phoneToCheck) return false;
      const { data: adminRow, error: adminErr } = await supabase
        .from("admin")
        .select("id")
        .eq("phone", phoneToCheck)
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
          email: user.email || null,
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
      // Merge any provided fields that are missing in the DB record
      const updatePayload = {};
      if (email && !userRowByUid.email) updatePayload.email = email;
      if (phone && !userRowByUid.phone) updatePayload.phone = phone;
      if (name && !userRowByUid.name) updatePayload.name = name;

      if (Object.keys(updatePayload).length > 0) {
        try {
          const { data: updatedUser, error: updateErr } = await supabase
            .from("users")
            .update(updatePayload)
            .eq("id", userRowByUid.id)
            .select()
            .maybeSingle();

          if (updateErr) {
            // handle unique constraint conflicts gracefully
            console.warn("Failed to update fields for user by uid:", updateErr);
          }
          const isAdmin = await checkAdmin(phone).catch((e) => {
            console.error("checkAdmin error:", e);
            throw e;
          });
          return finishResponse(updatedUser || userRowByUid, isAdmin);
        } catch (e) {
          console.error("Error updating userRowByUid:", e);
          return res.status(500).json({ error: "Database error" });
        }
      } else {
        const isAdmin = await checkAdmin(phone).catch((e) => {
          console.error("checkAdmin error:", e);
          throw e;
        });
        return finishResponse(userRowByUid, isAdmin);
      }
    }

    // 2) Not found by uid: try find by email (if email exists)
    if (email) {
      const { data: userByEmail, error: findByEmailErr } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (findByEmailErr) {
        console.error("Supabase error finding user by email:", findByEmailErr);
        return res.status(500).json({ error: "Database error" });
      }

      if (userByEmail) {
        // Link this existing email account to the uid and set phone/name if provided
        try {
          const updatePayload = { uid };
          if (phone && !userByEmail.phone) updatePayload.phone = phone;
          if (name && !userByEmail.name) updatePayload.name = name;

          const { data: updatedUser, error: updateErr } = await supabase
            .from("users")
            .update(updatePayload)
            .eq("id", userByEmail.id)
            .select()
            .maybeSingle();

          if (updateErr) console.warn("Failed to update uid on userByEmail:", updateErr);

          const isAdmin = await checkAdmin(phone).catch((e) => {
            console.error("checkAdmin error:", e);
            throw e;
          });

          const resultUser = updatedUser || { ...userByEmail, uid, phone: userByEmail.phone || phone, name: userByEmail.name || name, email: userByEmail.email };
          return finishResponse(resultUser, isAdmin);
        } catch (e) {
          console.error("Error updating userByEmail:", e);
          return res.status(500).json({ error: "Database error" });
        }
      }
    }

    // 3) Not found by uid or email: try find by phone (if phone exists)
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
        // Update this row to add uid and possibly email/name
        try {
          const updatePayload = { uid };
          if (email && !userByPhone.email) updatePayload.email = email;
          if (name && !userByPhone.name) updatePayload.name = name;

          const { data: updatedUser, error: updateErr } = await supabase
            .from("users")
            .update(updatePayload)
            .eq("id", userByPhone.id)
            .select()
            .maybeSingle();

          if (updateErr) console.warn("Failed to update uid on userByPhone:", updateErr);

          const isAdmin = await checkAdmin(phone).catch((e) => {
            console.error("checkAdmin error:", e);
            throw e;
          });

          const resultUser = updatedUser || { ...userByPhone, uid, email: userByPhone.email || email, name: userByPhone.name || name };
          return finishResponse(resultUser, isAdmin);
        } catch (e) {
          console.error("Error updating userByPhone:", e);
          return res.status(500).json({ error: "Database error" });
        }
      }
    }

    // 4) No existing user found by uid/email/phone -> create a new user row
    try {
      const insertObj = { uid, name: name || null, phone: phone || null, email: email || null };

      const { data: inserted, error: insertErr } = await supabase
        .from("users")
        .insert([insertObj])
        .select()
        .maybeSingle();

      if (insertErr) {
        console.error("Supabase error inserting user:", insertErr);

        // Unique constraint conflict handling: return 409 with helpful message
        // Supabase returns a string in insertErr.message often; we try to detect unique violation keywords
        const errMsg = insertErr?.message || String(insertErr);
        if (errMsg.toLowerCase().includes("unique") || errMsg.toLowerCase().includes("duplicate")) {
          return res.status(409).json({ error: "Email or phone already exists" });
        }

        return res.status(500).json({ error: "Database error" });
      }

      const newUser = inserted || { id: null, uid, name: name || null, phone: phone || null, email: email || null };
      const isAdmin = await checkAdmin(phone).catch((e) => {
        console.error("checkAdmin error:", e);
        throw e;
      });
      return finishResponse(newUser, isAdmin);
    } catch (e) {
      console.error("Error inserting new user:", e);
      return res.status(500).json({ error: "Database error" });
    }
  } catch (err) {
    console.error("/auth error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
