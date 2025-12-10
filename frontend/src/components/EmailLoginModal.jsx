// src/components/EmailLoginModal.jsx
import React, { useEffect, useState } from "react";
import {
  getAuth,
  signOut,
  deleteUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
} from "firebase/auth";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import styles from "../assets/components/PhoneLoginModal.module.css";

// backend base via Vite env
const RAW_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || "";
const BACKEND_BASE = RAW_BACKEND_BASE.replace(/\/+$/, ""); // strip trailing slash

function normalizePhone(raw) {
  if (!raw) return "";
  let s = String(raw).replace(/\D/g, ""); // digits only
  if (s.length === 10) return `+91${s}`;
  if (s.startsWith("91") && s.length === 12) return `+${s}`;
  if (s.startsWith("+")) return s;
  return s.length ? `+${s}` : "";
}

function isLikelyIndianPhone(raw) {
  const s = String(raw || "").replace(/\D/g, "");
  return s.length === 10 || (s.length === 12 && s.startsWith("91"));
}

function backendPath(path) {
  const base = BACKEND_BASE.replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}

export default function EmailLoginModal({ onClose, onSuccess }) {
  const auth = getAuth();
  const { loginWithFirebaseIdToken } = useAuth();

  const [mode, setMode] = useState("signup"); // "signup" | "signin"
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Phone requirement for first-time sign in (Google / OTP)
  const [phoneRequired, setPhoneRequired] = useState(false);
  const [pendingUserForPhone, setPendingUserForPhone] = useState(null);

  // form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    return () => {
      // noop cleanup for parity with Phone modal
    };
  }, []);

  // POST /auth helper
  async function postAuthToBackend(idToken, payload = {}) {
    const url = backendPath("/auth");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  }

  // persist local and notify backend; handles conflict by deleting firebase user when required
  async function persistAndFinish(firebaseUser, phoneToSave, extraPayload = {}) {
    const idToken = await firebaseUser.getIdToken(true);

    const payload = {
      name: firebaseUser.displayName || name || null,
      phone: firebaseUser.phoneNumber || phoneToSave || null,
      email: firebaseUser.email || email || null,
      ...extraPayload,
    };

    const { status, ok, data } = await postAuthToBackend(idToken, payload);

    // conflict handling (email/phone already exists) -> delete firebase user
    if (
      status === 409 ||
      (data && (data.error || "").toLowerCase().includes("exists"))
    ) {
      try {
        await deleteUser(firebaseUser);
      } catch (delErr) {
        console.warn(
          "Failed to delete Firebase user after backend conflict:",
          delErr
        );
        try {
          await signOut(auth);
        } catch (sErr) {
          console.warn("signOut fallback failed:", sErr);
        }
      }
      const msg = data && data.error ? data.error : "Email or phone already exists";
      const err = new Error(msg);
      err.status = status;
      err.backendData = data;
      throw err;
    }

    if (!ok) {
      console.warn("/auth backend failure:", status, data);
      const msg =
        (data && data.error) || "Backend error, please try again";
      const err = new Error(msg);
      err.status = status;
      err.backendData = data;
      throw err;
    }

    // success: persist locally (auth_token set by backend exchange below via loginWithFirebaseIdToken)
    try {
      localStorage.setItem("auth_token", idToken);
      if (firebaseUser.displayName) {
        localStorage.setItem("login_name", firebaseUser.displayName);
      } else if (name) {
        // fallback if displayName not set for OTP users
        localStorage.setItem("login_name", name);
      }
      const finalPhone = firebaseUser.phoneNumber || phoneToSave || "";
      if (finalPhone) {
        localStorage.setItem("customer_phone", finalPhone);
        if (typeof window !== "undefined") window.__CUSTOMER_PHONE__ = finalPhone;
      }
    } catch (e) {
      console.warn("localStorage write failed:", e);
    }

    // also call existing context wrapper so frontend gets server user + isAdmin etc.
    try {
      const emailToPass = firebaseUser.email || email || null;
      await loginWithFirebaseIdToken(
        idToken,
        firebaseUser.displayName || name || null,
        emailToPass
      );
    } catch (e) {
      console.warn("loginWithFirebaseIdToken warning:", e);
    }

    return data;
  }

  // Helper: complete login with backend and handle phone / email-verify errors
  async function finishLogin(firebaseUser, phoneOverride) {
    try {
      await persistAndFinish(firebaseUser, phoneOverride || null);
      toast.success("Signed in");
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      console.error("finishLogin error:", err);
      const msg = (err && err.message) || "";
      const status = err && err.status;

      if (
        status === 400 &&
        /phone number is required/i.test(msg || "")
      ) {
        // Ask user for phone to complete sign-in
        setPendingUserForPhone(firebaseUser);
        setPhoneRequired(true);
        toast.error("Phone number is required to complete sign in");
      } else if (
        status === 403 &&
        /email not verified/i.test(msg || "")
      ) {
        try {
          await signOut(auth);
        } catch (e) {
          console.warn("signOut after email-not-verified failed:", e);
        }
        toast.error("Email not verified. Please check your inbox.");
      } else {
        toast.error(msg || "Sign in failed");
      }
    } finally {
      setLoading(false);
    }
  }

  // ----------------- Email OTP (passwordless) Send OTP -----------------
  async function handleSendOtp() {
    const em = String(email || "").trim();
    if (!em) return toast.error("Enter email to receive OTP");

    const payload = { email: em };

    if (mode === "signup") {
      const nm = String(name || "").trim();
      const phRaw = String(phone || "").trim();

      if (!nm) return toast.error("Name is required");
      if (!phRaw) return toast.error("Phone is required");
      if (!isLikelyIndianPhone(phRaw))
        return toast.error("Phone must be a 10-digit Indian number");

      payload.name = nm;
      payload.phone = normalizePhone(phRaw);
      payload.intent = "signup";
    } else {
      payload.intent = "signin";
    }

    setLoading(true);
    try {
      const res = await fetch(backendPath("/auth/send-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (data && data.error) || "Failed to send OTP";
        throw new Error(msg);
      }
      toast.success("OTP sent to your email");
      setOtpSent(true);
    } catch (e) {
      console.error("send-otp failed:", e);
      toast.error(e?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  // ----------------- Email OTP (passwordless) Verify & Login/Signup -----------------
  async function handleVerifyOtp() {
    const em = String(email || "").trim();
    const code = String(otp || "").trim();
    if (!em) return toast.error("Enter email");
    if (!code) return toast.error("Enter OTP");

    const payload = { email: em, otp: code };

    let phoneOverride = null;

    if (mode === "signup") {
      const nm = String(name || "").trim();
      const phRaw = String(phone || "").trim();

      if (!nm) return toast.error("Name is required");
      if (!phRaw) return toast.error("Phone is required");
      if (!isLikelyIndianPhone(phRaw))
        return toast.error("Phone must be a 10-digit Indian number");

      const normalized = normalizePhone(phRaw);
      payload.name = nm;
      payload.phone = normalized;
      payload.intent = "signup";
      phoneOverride = normalized;
    } else {
      payload.intent = "signin";
    }

    setLoading(true);
    try {
      const res = await fetch(backendPath("/auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (data && data.error) || "Sign in with OTP failed";
        throw new Error(msg);
      }

      const { firebaseToken } = data || {};
      if (!firebaseToken) throw new Error("No login token received");

      const cred = await signInWithCustomToken(auth, firebaseToken);
      const firebaseUser = cred.user;

      await finishLogin(firebaseUser, phoneOverride);
    } catch (e) {
      console.error("Email OTP signin failed:", e);
      toast.error(e?.message || "Sign in with OTP failed");
      setLoading(false);
    }
  }

  // ----------------- Complete sign-in when phone is required -----------------
  async function handleCompletePhone() {
    const phRaw = String(phone || "").trim();
    if (!phRaw) return toast.error("Enter phone number");
    if (!isLikelyIndianPhone(phRaw))
      return toast.error("Phone must be a 10-digit Indian number");

    const normalized = normalizePhone(phRaw);

    if (!pendingUserForPhone) {
      toast.error("Something went wrong. Please try signing in again.");
      return;
    }

    setLoading(true);
    await finishLogin(pendingUserForPhone, normalized);
    setPhoneRequired(false);
    setPendingUserForPhone(null);
  }

  // ----------------- Google Signin (passwordless, doubles as signup) -----------------
  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const firebaseUser = res.user;

      // If Google doesn't provide phone, backend will enforce phone if needed.
      await finishLogin(firebaseUser, null);
    } catch (e) {
      console.error("Google signIn failed:", e);
      toast.error(e?.message || "Google sign in failed");
      setLoading(false);
    }
  }

  // ----------------- Render -----------------
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <button
          className={styles.modalClose}
          aria-label="Close sign in"
          onClick={() => {
            if (onClose) onClose();
          }}
        >
          ×
        </button>

        <div className={styles.phoneLoginCard}>
          <h2 className={styles.loginTitle}>
            {mode === "signup" ? "Create Account" : "Sign in"}
          </h2>

          <div className={styles.authSwitch}>
            <button
              onClick={() => {
                setMode("signup");
                setOtp("");
                setOtpSent(false);
              }}
              type="button"
              className={`${styles.authBtn} ${
                mode === "signup" ? styles.active : ""
              }`}
            >
              Sign Up
            </button>

            <button
              onClick={() => {
                setMode("signin");
                setOtp("");
                setOtpSent(false);
              }}
              type="button"
              className={`${styles.authBtn} ${
                mode === "signin" ? styles.active : ""
              }`}
            >
              Sign In
            </button>
          </div>

          {/* SIGN UP MODE: passwordless (OTP + Google) */}
          {mode === "signup" && (
            <>
              <input
                id="name"
                className="name-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />

              <div className={styles.phoneRow}>
                <div className={styles.phonePrefix}>+91</div>
                <input
                  id="phone"
                  className={styles.phoneInput}
                  placeholder="10 digit phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                />
              </div>

              <input
                id="email"
                className="name-input"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />

              {otpSent && (
                <input
                  id="otp"
                  className="name-input"
                  placeholder="Enter OTP sent to your email"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                />
              )}

              <div style={{ display: "flex", gap: 8 }}>
                {!otpSent && (
                  <button
                    className={styles.sendBtn}
                    onClick={handleSendOtp}
                    disabled={loading}
                    type="button"
                  >
                    {loading ? "Sending OTP..." : "Send OTP"}
                  </button>
                )}
                {otpSent && (
                  <button
                    className={styles.sendBtn}
                    onClick={handleVerifyOtp}
                    disabled={loading}
                    type="button"
                  >
                    {loading ? "Verifying..." : "Verify & Continue"}
                  </button>
                )}
              </div>

              <div style={{ marginTop: 8 }}>
                <small>
                  No password required. We will verify your email with a
                  one-time OTP and create your account.
                </small>
              </div>
            </>
          )}

          {/* SIGN IN MODE: passwordless (OTP + Google) */}
          {mode === "signin" && (
            <>
              <input
                id="email"
                className="name-input"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />

              {otpSent && (
                <input
                  id="otp-signin"
                  className="name-input"
                  placeholder="Enter OTP sent to your email"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                />
              )}

              <div style={{ display: "flex", gap: 8 }}>
                {!otpSent && (
                  <button
                    className={styles.sendBtn}
                    onClick={handleSendOtp}
                    disabled={loading}
                    type="button"
                  >
                    {loading ? "Sending OTP..." : "Send OTP"}
                  </button>
                )}
                {otpSent && (
                  <button
                    className={styles.sendBtn}
                    onClick={handleVerifyOtp}
                    disabled={loading}
                    type="button"
                  >
                    {loading ? "Signing in..." : "Sign in with OTP"}
                  </button>
                )}
              </div>

              <div style={{ marginTop: 8 }}>
                <small>
                  Enter the OTP we send to your email to sign in. No password,
                  ever.
                </small>
              </div>
            </>
          )}

          {/* Phone required after Google / OTP / first login */}
          {phoneRequired && (
            <div style={{ marginTop: 16 }}>
              <small style={{ display: "block", marginBottom: 4 }}>
                Phone number is required to complete sign in.
              </small>
              <div className={styles.phoneRow}>
                <div className={styles.phonePrefix}>+91</div>
                <input
                  id="phone-login"
                  className={styles.phoneInput}
                  placeholder="10 digit phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                />
              </div>
              <button
                className={styles.sendBtn}
                onClick={handleCompletePhone}
                disabled={loading}
                type="button"
                style={{ marginTop: 8 }}
              >
                {loading ? "Saving..." : "Save phone & continue"}
              </button>
            </div>
          )}

          {/* Google login for both modes */}
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
              Or continue with
            </div>
            <button
              className={styles.secondaryBtn}
              onClick={handleGoogleSignIn}
              disabled={loading}
              type="button"
            >
              Continue with Google
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <small>
              This is a completely passwordless login. You can sign in using a
              one-time OTP sent to your email or with Google. By creating an
              account you agree to provide a valid phone number if required.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
