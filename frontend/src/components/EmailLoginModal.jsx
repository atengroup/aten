// src/components/EmailLoginModal.jsx
import React, { useEffect, useState } from "react";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
  signOut,
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

export default function EmailLoginModal({ onClose, onSuccess }) {
  const auth = getAuth();
  const { loginWithFirebaseIdToken } = useAuth();

  const [mode, setMode] = useState("signup"); // "signup" | "signin"
  const [loading, setLoading] = useState(false);

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
    const base = BACKEND_BASE.replace(/\/+$/, "");
    const url = base ? `${base}/auth` : `/auth`;
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
  async function persistAndFinish(firebaseUser, phoneToSave) {
    const idToken = await firebaseUser.getIdToken(true);

    const payload = {
      name: firebaseUser.displayName || name || null,
      phone: firebaseUser.phoneNumber || phoneToSave || null,
      email: firebaseUser.email || email || null,
    };

    const { status, ok, data } = await postAuthToBackend(idToken, payload);

    // conflict handling (email/phone already exists)
    if (status === 409 || (data && (data.error || "").toLowerCase().includes("exists"))) {
      // try to delete firebase user to avoid orphaned auth (only on signup)
      try {
        await deleteUser(firebaseUser);
      } catch (delErr) {
        console.warn("Failed to delete Firebase user after backend conflict:", delErr);
        try { await signOut(auth); } catch (sErr) { console.warn("signOut fallback failed:", sErr); }
      }
      const msg = (data && data.error) ? data.error : "Email or phone already exists";
      throw new Error(msg);
    }

    if (!ok) {
      // backend error
      console.warn("/auth backend failure:", status, data);
      // try to delete created firebase user if this was a sign-up
      try { await deleteUser(firebaseUser); } catch (e) { /* ignore */ }
      throw new Error("Backend error, please try again");
    }

    // success: persist locally (auth_token set by backend exchange below via loginWithFirebaseIdToken)
    try {
      localStorage.setItem("auth_token", idToken);
      if (firebaseUser.displayName) localStorage.setItem("login_name", firebaseUser.displayName);
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
      await loginWithFirebaseIdToken(idToken, firebaseUser.displayName || null, emailToPass);
    } catch (e) {
      console.warn("loginWithFirebaseIdToken warning:", e);
    }

    return data;
  }

  // ----------------- Signup -----------------
  async function handleSignUp() {
    const em = String(email || "").trim();
    const pw = String(password || "");
    const nm = String(name || "").trim();
    const phRaw = String(phone || "").trim();

    if (!nm) return toast.error("Name is required");
    if (!phRaw) return toast.error("Phone is required");
    if (!isLikelyIndianPhone(phRaw)) return toast.error("Phone must be a 10-digit Indian number");
    if (!em) return toast.error("Email is required");
    if (!pw || pw.length < 6) return toast.error("Password must be at least 6 characters");

    const normalized = normalizePhone(phRaw);
    setLoading(true);

    try {
      const res = await createUserWithEmailAndPassword(auth, em, pw);
      const firebaseUser = res.user;

      // update displayName
      try { await updateProfile(firebaseUser, { displayName: nm }); } catch (e) { console.warn("updateProfile failed:", e); }

      // call backend and handle duplicates/conflicts
      try {
        await persistAndFinish(firebaseUser, normalized);
        toast.success("Account created and logged in");
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      } catch (backendErr) {
        // backendErr message likely includes "Email or phone already exists"
        toast.error(backendErr.message || "Account creation failed");
        return;
      }
    } catch (e) {
      console.error("createUserWithEmailAndPassword failed:", e);
      toast.error(e?.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  // ----------------- Signin -----------------
  async function handleSignIn() {
    const em = String(email || "").trim();
    const pw = String(password || "");
    if (!em) return toast.error("Enter email");
    if (!pw) return toast.error("Enter password");

    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, em, pw);
      const firebaseUser = res.user;

      try {
        await persistAndFinish(firebaseUser, null);
      } catch (e) {
        console.warn("persistAndFinish on signIn failed:", e);
        // even if persist fails, we may want to continue or force sign-out; choose to notify user
        toast.error(e?.message || "Sign in post-processing failed");
        return;
      }

      toast.success("Signed in");
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (e) {
      console.error("signIn failed:", e);
      toast.error(e?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  // ----------------- Reset -----------------
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

  // ----------------- Render -----------------
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <button
          className={styles.modalClose}
          aria-label="Close sign in"
          onClick={() => { if (onClose) onClose(); }}
        >
          ×
        </button>

        <div className={styles.phoneLoginCard}>
          <h2 className={styles.loginTitle}>{mode === "signup" ? "Create Account" : "Sign in"}</h2>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={() => setMode("signup")} type="button" style={{ fontWeight: mode === "signup" ? 600 : 400 }}>
              Sign Up
            </button>
            <button onClick={() => setMode("signin")} type="button" style={{ fontWeight: mode === "signin" ? 600 : 400 }}>
              Sign In
            </button>
          </div>

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
            </>
          )}

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
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {mode === "signup" ? (
            <button
              className={styles.sendBtn}
              onClick={handleSignUp}
              disabled={loading}
              type="button"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className={styles.sendBtn}
                onClick={handleSignIn}
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
          )}

          <div style={{ marginTop: 12 }}>
            <small>
              By creating an account you agree to provide a valid phone number. Passwords are stored securely by Firebase.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
