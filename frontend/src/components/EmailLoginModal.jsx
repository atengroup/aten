// src/components/EmailLoginModal.jsx
import React, { useEffect, useState } from "react";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  deleteUser,
  signOut,
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

  // Signin method: password or email OTP
  const [loginMethod, setLoginMethod] = useState("password"); // "password" | "otp"
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Phone requirement for first-time sign in (Google / OTP / password)
  const [phoneRequired, setPhoneRequired] = useState(false);
  const [pendingUserForPhone, setPendingUserForPhone] = useState(null);

  // form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
  // extraPayload lets us pass allowUnverified:true for signup
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
      if (firebaseUser.displayName)
        localStorage.setItem("login_name", firebaseUser.displayName);
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
        firebaseUser.displayName || null,
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

  // ----------------- Signup (email + password + verification link) -----------------
  async function handleSignUp() {
    const em = String(email || "").trim();
    const pw = String(password || "");
    const nm = String(name || "").trim();
    const phRaw = String(phone || "").trim();

    if (!nm) return toast.error("Name is required");
    if (!phRaw) return toast.error("Phone is required");
    if (!isLikelyIndianPhone(phRaw))
      return toast.error("Phone must be a 10-digit Indian number");
    if (!em) return toast.error("Email is required");
    if (!pw || pw.length < 6)
      return toast.error("Password must be at least 6 characters");

    const normalizedPhone = normalizePhone(phRaw);
    setLoading(true);

    try {
      const res = await createUserWithEmailAndPassword(auth, em, pw);
      const firebaseUser = res.user;

      // update displayName
      try {
        await updateProfile(firebaseUser, { displayName: nm });
      } catch (e) {
        console.warn("updateProfile failed:", e);
      }

      // Save unverified user in Supabase (allowUnverified:true)
      try {
        await persistAndFinish(firebaseUser, normalizedPhone, {
          allowUnverified: true,
        });
      } catch (err) {
        console.error("persistAndFinish during signup failed:", err);
        toast.error(err?.message || "Sign up failed");
        // Do not continue if backend rejected (duplicate, etc.)
        return;
      }

      // send email verification link
      try {
        await sendEmailVerification(firebaseUser);
        toast.success("Verification email sent. Please check your inbox.");
      } catch (e) {
        console.error("sendEmailVerification failed:", e);
        toast.error(
          "Account created, but failed to send verification email. Please try again later."
        );
      }

      // sign out, user must verify and then sign in
      try {
        await signOut(auth);
      } catch (e) {
        console.warn("signOut after signup failed:", e);
      }

      // Keep the modal open, switch to Sign In tab
      setMode("signin");
      setLoginMethod("password");
      setPassword(""); // clear password field, keep email/phone

      toast.success(
        "Account created. After verifying your email, sign in with the same email and password."
      );
    } catch (e) {
      console.error("createUserWithEmailAndPassword failed:", e);
      toast.error(e?.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  // ----------------- Password Signin -----------------
  async function handleSignInPassword() {
    const em = String(email || "").trim();
    const pw = String(password || "");
    if (!em) return toast.error("Enter email");
    if (!pw) return toast.error("Enter password");

    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, em, pw);
      const firebaseUser = res.user;
      // phone already stored at signup for email/password users
      await finishLogin(firebaseUser, null);
    } catch (e) {
      console.error("signIn failed:", e);
      toast.error("Sign in failed. Invalid credentials");
      setLoading(false);
    }
  }

  // ----------------- Email OTP (passwordless) Signin -----------------
  async function handleSendOtp() {
    const em = String(email || "").trim();
    if (!em) return toast.error("Enter email to receive OTP");

    setLoading(true);
    try {
      const res = await fetch(backendPath("/auth/send-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
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

  async function handleSignInWithOtp() {
    const em = String(email || "").trim();
    const code = String(otp || "").trim();
    if (!em) return toast.error("Enter email");
    if (!code) return toast.error("Enter OTP");

    setLoading(true);
    try {
      const res = await fetch(backendPath("/auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, otp: code }),
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

      await finishLogin(firebaseUser, null);
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

  // ----------------- Reset Password (email/password users) -----------------
  async function handleReset() {
    const em = String(email || "").trim();
    if (!em) return toast.error("Enter email to reset");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, em);
      toast.success("Password reset email sent");
    } catch (e) {
      console.error("sendPasswordResetEmail failed:", e);
      toast.error(e?.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  // ----------------- Google Signin (requires phone on first time) -----------------
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
                setLoginMethod("password");
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
                setLoginMethod("password");
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

          {/* SIGN UP MODE */}
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

              <input
                id="password"
                className="name-input"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />

              <button
                className={styles.sendBtn}
                onClick={handleSignUp}
                disabled={loading}
                type="button"
              >
                {loading ? "Creating..." : "Create account"}
              </button>

              <div style={{ marginTop: 8 }}>
                <small>
                  We will send a verification link to your email. Please verify
                  before signing in.
                </small>
              </div>
            </>
          )}

          {/* SIGN IN MODE */}
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

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 8,
                  marginBottom: 8,
                }}
              >
                <button
                  type="button"
                  className={`${styles.authBtn} ${
                    loginMethod === "password" ? styles.active : ""
                  }`}
                  onClick={() => {
                    setLoginMethod("password");
                    setOtp("");
                    setOtpSent(false);
                  }}
                >
                  Password login
                </button>
                <button
                  type="button"
                  className={`${styles.authBtn} ${
                    loginMethod === "otp" ? styles.active : ""
                  }`}
                  onClick={() => {
                    setLoginMethod("otp");
                    setPassword("");
                  }}
                >
                  Email OTP login
                </button>
              </div>

              {loginMethod === "password" && (
                <>
                  <input
                    id="password"
                    className="name-input"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className={styles.sendBtn}
                      onClick={handleSignInPassword}
                      disabled={loading}
                      type="button"
                    >
                      {loading ? "Signing in..." : "Sign In"}
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={handleReset}
                      disabled={loading}
                      type="button"
                    >
                      Forgot?
                    </button>
                  </div>
                </>
              )}

              {loginMethod === "otp" && (
                <>
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
                        onClick={handleSignInWithOtp}
                        disabled={loading}
                        type="button"
                      >
                        {loading ? "Signing in..." : "Sign in with OTP"}
                      </button>
                    )}
                  </div>
                </>
              )}
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
              By creating an account you agree to provide a valid phone number.
              Passwords are stored securely by Firebase. You can sign in using a
              password or one-time OTP sent to your email.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
