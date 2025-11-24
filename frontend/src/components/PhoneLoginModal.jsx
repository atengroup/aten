// src/components/PhoneLoginModal.jsx
import React, { useState, useEffect } from "react";
import { auth, createRecaptchaVerifier } from "../firebaseConfig";
import { signInWithPhoneNumber, updateProfile } from "firebase/auth";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import styles from "../assets/components/PhoneLoginModal.module.css";

// uploaded dev fallback image (path from your session)
const DEV_FALLBACK_IMAGE = "/mnt/data/cd4227da-020a-4696-be50-0e519da8ac56.png";

export default function PhoneLoginModal({ onClose, onSuccess }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("input");
  const { loginWithFirebaseIdToken } = useAuth();

  useEffect(() => {
    // cleanup recaptcha verifier on unmount
    return () => {
      try {
        if (window.recaptchaVerifier) delete window.recaptchaVerifier;
      } catch (e) {}
    };
  }, []);

  function setupRecaptcha() {
    try {
      if (typeof createRecaptchaVerifier === "function") createRecaptchaVerifier();
      return window.recaptchaVerifier || null;
    } catch (e) {
      console.warn("Recaptcha init failed:", e);
      return null;
    }
  }

  async function sendOtp() {
    const rawPhone = String(phone || "").trim();
    const rawName = String(name || "").trim();

    if (!rawName) return toast.error("Enter your name (required)");
    if (!rawPhone) return toast.error("Enter phone number");

    setLoading(true);
    try {
      const verifier = setupRecaptcha();
      let formatted = rawPhone;
      if (!formatted.startsWith("+")) formatted = `+91${formatted.replace(/^0+/, "")}`;

      if (!verifier) throw new Error("reCAPTCHA not initialized");

      const confirmationResult = await signInWithPhoneNumber(auth, formatted, verifier);
      setConfirmation(confirmationResult);
      setStep("otp");
      toast.success("OTP sent — check your phone");
    } catch (err) {
      console.error("sendOtp error", err);
      toast.error(err?.message || "Failed to send OTP");
      try { if (window.recaptchaVerifier) delete window.recaptchaVerifier; } catch (e) {}
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!confirmation) return toast.error("Send OTP first");
    const code = String(otp || "").trim();
    if (!code) return toast.error("Enter OTP");
    setLoading(true);
    try {
      const result = await confirmation.confirm(code);
      const firebaseUser = result.user;

      // set displayName if provided (best-effort)
      const trimmedName = String(name || "").trim();
      if (trimmedName) {
        try {
          await updateProfile(firebaseUser, { displayName: trimmedName });
        } catch (e) {
          console.warn("updateProfile failed:", e);
        }
      }

      // get fresh token and persist to localStorage (auth flow)
      const idToken = await firebaseUser.getIdToken(true);
      localStorage.setItem("auth_token", idToken);

      // store phone
      const normalizedPhone = firebaseUser.phoneNumber || phone;
      if (normalizedPhone) {
        try { localStorage.setItem("customer_phone", normalizedPhone); } catch (e) {}
        if (typeof window !== "undefined") window.__CUSTOMER_PHONE__ = normalizedPhone;
      }

      // exchange token with backend via auth context
      let maybeUser = null;
      try {
        const ret = await loginWithFirebaseIdToken(idToken, trimmedName || null);
        if (ret && typeof ret === "object" && (ret.id || ret.uid)) maybeUser = ret;
      } catch (err) {
        console.warn("loginWithFirebaseIdToken failed:", err);
      }

      // try to read user from localStorage
      const userObjLocal = JSON.parse(localStorage.getItem("user") || "null");
      const finalUser = userObjLocal && (userObjLocal.id || userObjLocal.uid) ? userObjLocal : maybeUser;

      toast.success("Logged in");

      if (onSuccess) onSuccess(finalUser || null);
      if (onClose) onClose();
    } catch (err) {
      console.error("verifyOtp error", err);
      toast.error("OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setPhone("");
    setOtp("");
    setConfirmation(null);
    setStep("input");
    try { if (window.recaptchaVerifier) delete window.recaptchaVerifier; } catch (e) {}
  }

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
          <h2 className={styles.loginTitle}>Sign in with phone</h2>

          {step === "input" && (
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
                  className="phone-input"
                  placeholder="10 digit phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                />
              </div>

              <button
                className={styles.sendBtn}
                onClick={sendOtp}
                disabled={loading}
                type="button"
              >
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </>
          )}

          {step === "otp" && (
            <>
              <div className={styles.otpInstruction}>OTP sent to <strong>{phone}</strong></div>

              <input
                id="otp"
                className="otp-input"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
              />

              <div className={styles.otpActions}>
                <button
                  className={styles.verifyBtn}
                  onClick={verifyOtp}
                  disabled={loading}
                  type="button"
                >
                  {loading ? "Verifying..." : "Verify & Sign in"}
                </button>
                <button
                  className={styles.secondaryBtn}
                  onClick={resetAll}
                  disabled={loading}
                  type="button"
                >
                  Start over
                </button>
              </div>
            </>
          )}

          <div id="recaptcha-container" />
        </div>
      </div>
    </div>
  );
}
