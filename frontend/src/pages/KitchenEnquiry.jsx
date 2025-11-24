// src/pages/KitchenEnquiry.jsx
import React, { useState } from "react";
import OptionGroup from "../components/OptionGroup";
import PhoneLoginModal from "../components/PhoneLoginModal";
import styles from "../assets/pages/HomeEnquiry.module.css";
const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");
const KITCHEN_TYPES = [
  { id: "modular", label: "Modular Kitchen", image: "/kitchen1.jpg", bullets: ["Fully customizable", "Optimized storage"] },
  { id: "semi-modular", label: "Semi Modular Kitchen", image: "/kitchen1.jpg", bullets: [" Customizable", "Optimized storage"] }
];

const KITCHEN_THEMES = [
  { id: "open", label: "Open", image: "/images/kitchens/open.jpg", bullets: ["Integrated living", "Social layout"] },
  { id: "closed", label: "Closed", image: "/images/kitchens/closed.jpg", bullets: ["Odour control", "Defined zones"] },
  { id: "island", label: "Island", image: "/images/kitchens/island.jpg", bullets: ["Extra prep space", "Casual seating"] },
  { id: "lshape", label: "L-shaped", image: "/images/kitchens/lshape.jpg", bullets: ["Efficient flow", "Flexible layout"] },
  { id: "galley", label: "Galley", image: "/images/kitchens/galley.jpg", bullets: ["Compact", "Great for small kitchens"] }
];

export default function KitchenEnquiry() {
  const [selectedKitchenType, setSelectedKitchenType] = useState(null);
  const [selectedKitchenTheme, setSelectedKitchenTheme] = useState(null);
  const [form, setForm] = useState({ email: "", city: "", area: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  function handleFormChange(e) { const { name, value } = e.target; setForm((s) => ({ ...s, [name]: value })); }
  function findLabel(list, id) { const f = list.find((i) => i.id === id); return f ? f.label : id; }

  async function doSubmit(userId = null) {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const uid = userId || storedUser.id || null;
    const payload = { user_id: uid, type: "kitchen", email: form.email || null, city: form.city || null, area: form.area || null, kitchen_type: selectedKitchenType ? findLabel(KITCHEN_TYPES, selectedKitchenType) : null, kitchen_theme: selectedKitchenTheme ? findLabel(KITCHEN_THEMES, selectedKitchenTheme) : null };
    try {
      setLoading(true); setMessage(null);
      const res = await fetch("${BACKEND_BASE}/api/kb_enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");
      setMessage({ type: "success", text: "Kitchen enquiry saved successfully" });
      setForm({ email: "", city: "", area: "" });
      setSelectedKitchenType(null); setSelectedKitchenTheme(null);
    } catch (err) { console.error(err); setMessage({ type: "error", text: err.message || "Submit failed" }); }
    finally { setLoading(false); setPendingSubmit(false); }
  }

  async function handleSubmit(e) {
    e && e.preventDefault(); setMessage(null);
    if (!form.email || form.email.trim() === "") { setMessage({ type: "error", text: "Email is required" }); return; }
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser.id || null;
    if (!userId) { setPendingSubmit(true); setShowLoginModal(true); return; }
    await doSubmit(userId);
  }

  function handleLoginSuccess(userObj = null) {
    setShowLoginModal(false);
    const userId = userObj?.id || JSON.parse(localStorage.getItem("user") || "{}").id || null;
    if (pendingSubmit) setTimeout(() => doSubmit(userId), 200);
  }

  const steps = [{ key: "ktype", label: "Kitchen Type" }, { key: "ktheme", label: "Kitchen Theme" }];
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className={`${styles.homeEnquiryPage} wide-left`}>
      <div className={styles.leftPanel}>
        <h3>Kitchen Options</h3>
        <div className={styles.progressBar}>
          {steps.map((s, idx) => {
            const completed = idx < activeStep; const active = idx === activeStep;
            return (
              <button key={s.key} type="button" className={`${styles.step} ${active ? styles.stepActive : completed ? styles.stepCompleted : ""}`} onClick={() => setActiveStep(idx)}>
                <div className={styles.stepIndex}>{idx + 1}</div>
                <div>{s.label}</div>
              </button>
            );
          })}
        </div>

        <div className="option-stage">
          {activeStep === 0 && <OptionGroup title="Kitchen Type" options={KITCHEN_TYPES} multi={false} selected={selectedKitchenType} onChange={setSelectedKitchenType} />}
          {activeStep === 1 && <OptionGroup title="Kitchen Theme" options={KITCHEN_THEMES} multi={false} selected={selectedKitchenTheme} onChange={setSelectedKitchenTheme} />}

          <div className={styles.stepNav}>
            <button type="button" className={styles.navBtn} onClick={() => setActiveStep((s) => Math.max(0, s - 1))} disabled={activeStep === 0}>Previous</button>
            <button type="button" className={styles.navBtn} onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))} disabled={activeStep === steps.length - 1}>Next</button>
          </div>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <h2>Kitchen Enquiry</h2>
        <form className={styles.enquiryForm} onSubmit={handleSubmit}>
          <label>
            Email *
            <input name="email" value={form.email} onChange={handleFormChange} type="email" placeholder="you@example.com" />
          </label>

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
            <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? "Saving..." : "Submit Enquiry"}</button>
          </div>

          {message && <div className={`${styles.formMessage} ${message.type === "error" ? styles.formMessageError : styles.formMessageSuccess}`} style={{ marginTop: 12 }}>{message.text}</div>}
        </form>
      </div>

      {showLoginModal && <PhoneLoginModal onClose={() => { setShowLoginModal(false); setPendingSubmit(false); }} onSuccess={handleLoginSuccess} />}
    </div>
  );
}
