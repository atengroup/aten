// src/components/PhoneLogin.jsx
import React, { useState, useEffect } from "react";
import { auth, createRecaptchaVerifier } from "../firebaseConfig";
import { signInWithPhoneNumber, updateProfile } from "firebase/auth";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import styles from "../assets/components/PhoneLogin.module.css";

// uploaded session asset (will be transformed to a URL by your environment)
const DEV_FALLBACK_IMAGE = "/mnt/data/cd4227da-020a-4696-be50-0e519da8ac56.png";

export default function PhoneLogin() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("input");
  const { loginWithFirebaseIdToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // cleanup recaptcha on unmount
  useEffect(() => {
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

      // update displayName if provided
      const trimmedName = String(name || "").trim();
      if (trimmedName) {
        try {
          await updateProfile(firebaseUser, { displayName: trimmedName });
        } catch (e) {
          console.warn("updateProfile failed:", e);
        }
      }

      // force token refresh
      const idToken = await firebaseUser.getIdToken(true);

      // store idToken locally and inform backend/context
      localStorage.setItem("auth_token", idToken);
      if (trimmedName) {
        try { localStorage.setItem("login_name", trimmedName); } catch (e) {}
      }
      const normalizedPhone = firebaseUser.phoneNumber || phone;
      if (normalizedPhone) {
        try { localStorage.setItem("customer_phone", normalizedPhone); } catch (e) {}
        if (typeof window !== "undefined") window.__CUSTOMER_PHONE__ = normalizedPhone;
      }

      await loginWithFirebaseIdToken(idToken, trimmedName || null);
      toast.success("Logged in");

      const fromPath = location.state?.from?.pathname || "";
      const cameFromTestimonial =
        typeof fromPath === "string" &&
         fromPath.includes("/testimonials");

      const target = cameFromTestimonial ? fromPath : "/";
      navigate(target, { replace: true });
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
    <div className={styles.phoneLoginPage}>
      <div className={styles.phoneLoginCard}>
        <h2 className={styles.loginTitle}>Sign in with phone</h2>

        {step === "input" && (
          <>
            <input
              id="name"
              className={styles.nameInput}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
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

            <button
              className={styles.sendBtn}
              onClick={sendOtp}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className={styles.btnSpinner} aria-hidden="true" />
                  Sending...
                </>
              ) : (
                "Send OTP"
              )}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <div className={styles.otpInstruction}>OTP sent to <strong>{phone}</strong></div>

            <input
              id="otp"
              className={styles.otpInput}
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
            />

            <div className={styles.otpActions}>
              <button className={styles.verifyBtn} onClick={verifyOtp} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Sign in"}
              </button>
              <button className={styles.secondaryBtn} onClick={resetAll} disabled={loading}>
                Start over
              </button>
            </div>
          </>
        )}

        <div id="recaptcha-container" />
        <div className={styles.loginNote} />
      </div>
    </div>
  );
}
