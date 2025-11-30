// src/pages/KitchenEnquiry.jsx
import React, { useState } from "react";
import OptionGroup from "../components/OptionGroup";
import styles from "../assets/pages/HomeEnquiry.module.css";
import EmailLoginModal from "../components/EmailLoginModal";
import { useNavigate } from "react-router-dom";

const RAW_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || "";
const BACKEND_BASE = RAW_BACKEND_BASE.replace(/\/+$/, ""); // strip trailing slash
function buildUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!BACKEND_BASE) return p;
  return `${BACKEND_BASE}${p}`.replace(/([^:]\/)\/+/g, "$1");
}

const KITCHEN_TYPES = [
  { id: "modular", label: "Modular Kitchen", image: "/kitchen1.webp", bullets: ["Fully customizable", "Optimized storage"] },
  { id: "semi-modular", label: "Semi Modular Kitchen", image: "/kitchen-i1.webp", bullets: [" Customizable", "Optimized storage"] }
];

const KITCHEN_THEMES = [
  { id: "open", label: "Open", image: "/open-k.webp", bullets: ["Integrated living", "Social layout"] },
  { id: "lshape", label: "L-shaped", image: "/l-shaped-k.webp", bullets: ["Efficient flow", "Flexible layout"] },
  { id: "galley", label: "Galley", image: "/galley-k.webp", bullets: ["Compact", "Great for small kitchens"] }
];

export default function KitchenEnquiry() {
  const [selectedKitchenType, setSelectedKitchenType] = useState(null);
  const [selectedKitchenTheme, setSelectedKitchenTheme] = useState(null);
  const navigate = useNavigate()
  // removed email from form state — email will be taken from logged-in user
  const [form, setForm] = useState({ city: "", area: "" });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  function findLabel(list, id) {
    const f = list.find((i) => i.id === id);
    return f ? f.label : id;
  }

  // doSubmit accepts optional userId (UUID) or userObj; if not provided it reads from localStorage
  async function doSubmit(userId = null, userObj = null) {
    const storedUser = userObj || JSON.parse(localStorage.getItem("user") || "null") || JSON.parse(localStorage.getItem("user") || "{}");
    const uid = userId || (storedUser && (storedUser.id || storedUser.uid)) || null;
    const email = (storedUser && storedUser.email) || null;

    const payload = {
      user_id: uid,
      email: email,
      type: "kitchen",
      city: form.city || null,
      area: form.area || null,
      kitchen_type: selectedKitchenType ? findLabel(KITCHEN_TYPES, selectedKitchenType) : null,
      kitchen_theme: selectedKitchenTheme ? findLabel(KITCHEN_THEMES, selectedKitchenTheme) : null,
    };

    try {
      setLoading(true);
      setMessage(null);

      const url = buildUrl("/api/kb_enquiries");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Server error");

      setMessage({ type: "success", text: "Kitchen enquiry saved successfully" });
      // reset only the fields that are part of the form (email removed)
      setForm({ city: "", area: "" });
      setSelectedKitchenType(null);
      setSelectedKitchenTheme(null);
    } catch (err) {
      console.error("doSubmit error:", err);
      setMessage({ type: "error", text: err?.message || "Submit failed" });
    } finally {
      setLoading(false);
      setPendingSubmit(false);
    }
  }

  async function handleSubmit(e) {
    e && e.preventDefault();
    setMessage(null);

    // email removed from UI. We require login to attach user email/user_id.
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser.id || null;

    if (!userId) {
      setPendingSubmit(true);
      setShowLoginModal(true);
      return;
    }

    await doSubmit(userId, storedUser);
  }

  function handleLoginSuccess(userObj = null) {
    setShowLoginModal(false);

    // prefer userObj returned by modal; otherwise read localStorage
    const userFromModal = userObj || JSON.parse(localStorage.getItem("user") || "null") || JSON.parse(localStorage.getItem("user") || "{}");

    if (pendingSubmit) {
      // slight delay to allow login flow to persist to localStorage if necessary
      setTimeout(() => doSubmit(userFromModal?.id || userFromModal?.uid || null, userFromModal), 200);
    }
  }

  const steps = [{ key: "ktype", label: "Kitchen Type" }, { key: "ktheme", label: "Kitchen Theme" }];
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className={`${styles.homeEnquiryPage} wide-left`}>
      <div className={styles.leftPanel}>
        <h3>Kitchen Options</h3>
        <div className={styles.progressBar}>
          {steps.map((s, idx) => {
            const completed = idx < activeStep;
            const active = idx === activeStep;
            return (
              <button
                key={s.key}
                type="button"
                className={`${styles.step} ${active ? styles.stepActive : completed ? styles.stepCompleted : ""}`}
                onClick={() => setActiveStep(idx)}
              >
                <div className={styles.stepIndex}>{idx + 1}</div>
                <div>{s.label}</div>
              </button>
            );
          })}
        </div>

        <div className="option-stage">
          {activeStep === 0 && (
            <OptionGroup title="Kitchen Type" options={KITCHEN_TYPES} multi={false} selected={selectedKitchenType} onChange={setSelectedKitchenType} />
          )}
          {activeStep === 1 && (
            <OptionGroup title="Kitchen Theme" options={KITCHEN_THEMES} multi={false} selected={selectedKitchenTheme} onChange={setSelectedKitchenTheme} />
          )}

          <div className={styles.stepNav}>
            <button type="button" className={styles.navBtn} onClick={() => setActiveStep((s) => Math.max(0, s - 1))} disabled={activeStep === 0}>
              Previous
            </button>
            <button type="button" className={styles.navBtn} onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))} disabled={activeStep === steps.length - 1}>
              Next
            </button>
          </div>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate(-1)}
          >
            Back
          </button>
        <h2>Kitchen Enquiry</h2>
        <form className={styles.enquiryForm} onSubmit={handleSubmit}>
          {/* Email removed from UI — will be taken from logged-in user and sent in payload */}

          <label>
            City
            <input name="city" value={form.city} onChange={handleFormChange} type="text" />
          </label>

          <label>
            Area (sq ft)
            <input name="area" value={form.area} onChange={handleFormChange} type="number" />
          </label>

          <div className={styles.selectedSummary}>
            {selectedKitchenType && <span className={styles.chip}>{findLabel(KITCHEN_TYPES, selectedKitchenType)}</span>}
            {selectedKitchenTheme && <span className={styles.chip}>{findLabel(KITCHEN_THEMES, selectedKitchenTheme)}</span>}
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Saving..." : "Submit Enquiry"}
            </button>
          </div>

          {message && (
            <div className={`${styles.formMessage} ${message.type === "error" ? styles.formMessageError : styles.formMessageSuccess}`} style={{ marginTop: 12 }}>
              {message.text}
            </div>
          )}
        </form>
      </div>

      {showLoginModal && (
        <EmailLoginModal
          onClose={() => {
            setShowLoginModal(false);
            setPendingSubmit(false);
          }}
          onSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
