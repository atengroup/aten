import React, { useState } from "react";
import OptionGroup from "../components/OptionGroup";
import PhoneLoginModal from "../components/PhoneLoginModal";
import "../assets/pages/HomeEnquiry.css"; // reuse same styles

// kitchen type (modular only)
const KITCHEN_TYPES = [
  { id: "modular", label: "Modular Kitchen", image: "/images/kitchen/modular.jpg", bullets: ["Fully customizable", "Optimized storage"] }
];

// kitchen themes reused from home page kitchen type
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

  const steps = [
    { key: "ktype", label: "Kitchen Type" },
    { key: "ktheme", label: "Kitchen Theme" }
  ];
  const [activeStep, setActiveStep] = useState(0);

  // control modal state
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

  function goNext() { setActiveStep((s) => Math.min(steps.length - 1, s + 1)); }
  function goPrev() { setActiveStep((s) => Math.max(0, s - 1)); }

  // helper that actually posts the enquiry
  async function doSubmit(userId = null) {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const uid = userId || storedUser.id || null;

    const payload = {
      user_id: uid,
      type: "kitchen",
      email: form.email || null,
      city: form.city || null,
      area: form.area || null,
      bathroom_type: null,
      kitchen_type: selectedKitchenType ? findLabel(KITCHEN_TYPES, selectedKitchenType) : null,
      kitchen_theme: selectedKitchenTheme ? findLabel(KITCHEN_THEMES, selectedKitchenTheme) : null
    };

    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch("/api/kb_enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");

      setMessage({ type: "success", text: "Kitchen enquiry saved successfully" });
      setForm({ email: "", city: "", area: "" });
      setSelectedKitchenType(null);
      setSelectedKitchenTheme(null);
      setActiveStep(0);
    } catch (err) {
      console.error("kb_enquiries submit failed:", err);
      setMessage({ type: "error", text: err.message || "Submit failed" });
    } finally {
      setLoading(false);
      setPendingSubmit(false);
    }
  }

  // main submit handler
  async function handleSubmit(e) {
    e && e.preventDefault();
    setMessage(null);

    if (!form.email || form.email.trim() === "") {
      setMessage({ type: "error", text: "Email is required" });
      return;
    }

    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser.id || null;

    if (!userId) {
      // Option B: immediately open login modal
      setPendingSubmit(true);
      setShowLoginModal(true);
      return;
    }

    // already logged in
    await doSubmit(userId);
  }

  // called when PhoneLoginModal reports success
  // modal will pass userObj if available
  function handleLoginSuccess(userObj = null) {
    setShowLoginModal(false);
    const userId = userObj?.id || JSON.parse(localStorage.getItem("user") || "{}").id || null;

    if (pendingSubmit) {
      // small delay to ensure localStorage has been written
      setTimeout(() => {
        doSubmit(userId);
      }, 200);
    }
  }

  return (
    <div className="home-enquiry-page wide-left">
      <div className="left-panel">
        <h3>Kitchen Options</h3>

        <div className="progress-bar">
          {steps.map((s, idx) => {
            const completed = idx < activeStep;
            const active = idx === activeStep;
            return (
              <button
                key={s.key}
                type="button"
                className={"step " + (active ? "active" : completed ? "completed" : "")}
                onClick={() => setActiveStep(idx)}
              >
                <div className="step-index">{idx + 1}</div>
                <div className="step-label">{s.label}</div>
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

          <div className="step-nav">
            <button type="button" className="nav-btn" onClick={goPrev} disabled={activeStep === 0}>Previous</button>
            <button type="button" className="nav-btn" onClick={goNext} disabled={activeStep === steps.length - 1}>Next</button>
          </div>
        </div>
      </div>

      <div className="right-panel narrow-form">
        <h2>Kitchen Enquiry</h2>
        <form className="enquiry-form" onSubmit={handleSubmit}>
          <label>
            Email *
            <input
              name="email"
              value={form.email}
              onChange={handleFormChange}
              type="email"
              placeholder="you@example.com"
            />
          </label>

          <label>
            City
            <input name="city" value={form.city} onChange={handleFormChange} type="text" />
          </label>

          <label>
            Area (sq ft)
            <input name="area" value={form.area} onChange={handleFormChange} type="number" />
          </label>

          <div className="selected-summary">
            {selectedKitchenType && <span className="chip">{findLabel(KITCHEN_TYPES, selectedKitchenType)}</span>}
            {selectedKitchenTheme && <span className="chip">{findLabel(KITCHEN_THEMES, selectedKitchenTheme)}</span>}
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Saving..." : "Submit Enquiry"}
            </button>
          </div>

          {message && (
            <div className={"form-message " + (message.type === "error" ? "error" : "success")}>
              {message.text}
            </div>
          )}
        </form>
      </div>

      {/* Phone login modal (Option B: open immediately on submit if not logged in) */}
      {showLoginModal && (
        <PhoneLoginModal
          onClose={() => { setShowLoginModal(false); setPendingSubmit(false); }}
          onSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
