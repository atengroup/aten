// backend/routes/authRoutes.js
const express = require("express");
const supabase = require("../supabase");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const admin = require("../firebaseAdmin");

const router = express.Router();

// In-memory OTP store (replace with Redis in production)
const otpStore = new Map(); // { email: { otp: "123456", expires: timestamp, sentAt } }

// Helper: Generate 6-digit OTP
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Helper: Send OTP email (replace with your email service)
const sendOtpEmail = async (email, otp) => {
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Your App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Login OTP - Valid for 5 minutes",
    text: `Your OTP is: ${otp}\n\nThis code expires in 5 minutes.`,
    html: `<p>Your OTP is: <strong>${otp}</strong></p><p>Valid for 5 minutes.</p>`,
  });
};

// ---------------------------------------------------------------------
//  OTP LOGIN ENDPOINTS (PASSWORDLESS LOGIN ONLY, NOT SIGNUP)
// ---------------------------------------------------------------------

// POST /auth/send-otp  (for LOGIN ONLY)
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log("[/auth/send-otp] request for:", normalizedEmail);

    // Ensure this is LOGIN only: user must already exist in Firebase
    try {
      await admin.auth().getUserByEmail(normalizedEmail);
    } catch (e) {
      if (e.code === "auth/user-not-found") {
        console.log(
          "[/auth/send-otp] no Firebase user for email:",
          normalizedEmail
        );
        return res
          .status(404)
          .json({ error: "No account with this email" });
      }
      console.error("[/auth/send-otp] error checking Firebase user:", e);
      return res.status(500).json({ error: "Internal error" });
    }

    // Simple rate limiting (disabled in development)
    const isDev = process.env.NODE_ENV === "development";
    const record = otpStore.get(normalizedEmail);
    if (!isDev && record && Date.now() - record.sentAt < 60_000) {
      console.log(
        "[/auth/send-otp] rate limited for:",
        normalizedEmail,
        "last sent at:",
        new Date(record.sentAt).toISOString()
      );
      return res
        .status(429)
        .json({ error: "Too many requests. Try again in 1 minute." });
    }

    // Generate and store OTP
    const otp = generateOtp();
    const expires = Date.now() + 5 * 60 * 1000; // 5 min

    otpStore.set(normalizedEmail, {
      otp,
      expires,
      sentAt: Date.now(),
    });

    console.log(
      "[/auth/send-otp] generated OTP for",
      normalizedEmail,
      "otp:",
      otp
    );

    // Send email
    await sendOtpEmail(normalizedEmail, otp);
    console.log("[/auth/send-otp] OTP email sent to", normalizedEmail);

    return res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error("[/auth/send-otp] unexpected error:", err);
    return res
      .status(500)
      .json({ error: "Failed to send OTP. Try again." });
  }
});

// POST /auth/verify-otp  (LOGIN ONLY, returns Firebase custom token)
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP required" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return res.status(400).json({ error: "No OTP requested or expired" });
  }

  if (Date.now() > record.expires) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({ error: "OTP expired" });
  }

  if (record.otp !== otp.trim()) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  // OTP valid → delete it
  otpStore.delete(normalizedEmail);

  try {
    // LOGIN ONLY: require that a Firebase user exists for this email
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(normalizedEmail);
    } catch (e) {
      if (e.code === "auth/user-not-found") {
        return res.status(404).json({ error: "No account with this email" });
      }
      console.error("getUserByEmail failed in verify-otp:", e);
      return res.status(500).json({ error: "Authentication failed" });
    }

    // Custom token tied to the user's Firebase UID
    const firebaseToken = await admin
      .auth()
      .createCustomToken(userRecord.uid, { emailOtp: true });

    // Note: Supabase user creation/updates are handled only in POST /auth below.
    res.json({ firebaseToken });
  } catch (err) {
    console.error("Firebase token creation failed:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// ---------------------------------------------------------------------
//  MAIN /auth ROUTE
//  - Used after ANY Firebase sign-in (password, Google, custom token/OTP)
//  - Enforces email verification for email/password login
//  - Enforces phone requirement on first time (e.g., Google sign-in)
//  - At SIGNUP we explicitly allow unverified via allowUnverified flag
// ---------------------------------------------------------------------

router.post("/", verifyFirebaseToken, async (req, res) => {
  try {
    const firebaseUser = req.firebaseUser || {};
    const uid = firebaseUser.uid || firebaseUser.email; // support OTP login (email as uid, if any)
    const phoneFromBody = req.body.phone || null;
    const phone = firebaseUser.phone_number || phoneFromBody || null;
    const email = firebaseUser.email || req.body.email || null;
    const name = firebaseUser.name || req.body.name || null;

    if (!uid) {
      return res.status(400).json({ error: "No uid/email in token" });
    }

    const signInProvider =
      firebaseUser.firebase && firebaseUser.firebase.sign_in_provider
        ? firebaseUser.firebase.sign_in_provider
        : null;

    // Allow unverified user only when explicitly requested (signup)
    const allowUnverified = !!req.body.allowUnverified;

    // For provider "password", if email is not verified, block unless allowUnverified is true.
    if (
      !allowUnverified &&
      signInProvider === "password" &&
      firebaseUser.email &&
      firebaseUser.email_verified === false
    ) {
      return res
        .status(403)
        .json({ error: "Email not verified. Please verify your email." });
    }

    // For OTP login via custom token (provider === "custom"), we treat
    // possession of the OTP as sufficient and do NOT enforce email_verified.

    // -----------------------------------------------------------------
    // Helper: check admin by phone
    // -----------------------------------------------------------------
    const checkAdmin = async (phoneToCheck) => {
      if (!phoneToCheck) return false;
      const { data } = await supabase
        .from("admin")
        .select("id")
        .eq("phone", phoneToCheck)
        .maybeSingle();
      return !!data;
    };

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

    // -----------------------------------------------------------------
    // 1. Find user by uid (Firebase UID or email-uid)
    // -----------------------------------------------------------------
    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("uid", uid)
      .maybeSingle();

    if (user) {
      // Existing user: optionally backfill missing data (no hard phone requirement here)
      const updatePayload = {};
      if (email && !user.email) updatePayload.email = email;
      if (phone && !user.phone) updatePayload.phone = phone;
      if (name && !user.name) updatePayload.name = name;

      if (Object.keys(updatePayload).length > 0) {
        const { data: updated } = await supabase
          .from("users")
          .update(updatePayload)
          .eq("id", user.id)
          .select()
          .single();
        user = updated || user;
      }

      const isAdmin = await checkAdmin(phone || user.phone);
      return finishResponse(user, isAdmin);
    }

    // -----------------------------------------------------------------
    // 2. Not found by uid → try by email
    // -----------------------------------------------------------------
    if (email) {
      const { data: byEmail } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (byEmail) {
        // User exists by email; update with uid/phone/name
        const { data: updated } = await supabase
          .from("users")
          .update({
            uid,
            phone: phone || byEmail.phone,
            name: name || byEmail.name,
          })
          .eq("id", byEmail.id)
          .select()
          .single();
        const isAdmin = await checkAdmin(phone || byEmail.phone);
        return finishResponse(updated || byEmail, isAdmin);
      }
    }

    // -----------------------------------------------------------------
    // 3. Not found → create new user
    //    - REQUIRE phone number for first-time creation.
    //    - This is what will enforce "must add phone" for Google sign-in,
    //      OTP-first sign-in, etc.
    // -----------------------------------------------------------------
    if (!phone) {
      return res
        .status(400)
        .json({ error: "Phone number is required to complete sign in." });
    }

    const { data: inserted, error } = await supabase
      .from("users")
      .insert([{ uid, email, phone, name }])
      .select()
      .single();

    if (error) {
      if (error.message && error.message.toLowerCase().includes("duplicate")) {
        return res.status(409).json({ error: "Email or phone already exists" });
      }
      console.error("Supabase insert error in /auth:", error);
      return res.status(500).json({ error: "Failed to create user" });
    }

    const isAdmin = await checkAdmin(phone);
    return finishResponse(inserted, isAdmin);
  } catch (err) {
    console.error("/auth error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
