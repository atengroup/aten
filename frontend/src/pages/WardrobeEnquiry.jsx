// File: src/pages/WardrobeEnquiry.jsx
import React, { useState } from "react";
import OptionGroup from "../components/OptionGroup";
import PhoneLoginModal from "../components/PhoneLoginModal";
import "../assets/pages/HomeEnquiry.css"; // reuse your responsive CSS

// Use uploaded image path (toolchain will convert to a real URL)
const HEADER_IMG = "/mnt/data/42b8911c-caea-4d06-8741-4f7cabe964e2.png";

/* Option data - replace image paths if you have real assets */
const WARDROBE_TYPES = [
  { id: "slide", label: "Sliding", image: "/images/wardrobe/slide.jpg", bullets: ["Space saving", "Modern look"] },
  { id: "swing", label: "Swing", image: "/images/wardrobe/swing.jpg", bullets: ["Traditional", "Full access"] }
];

const MATERIALS = [
  { id: "engineered_wood", label: "Engineered Wood", image: "/images/materials/ew.jpg", bullets: ["Stable", "Cost-effective"] },
  { id: "solid_wood", label: "Solid Wood", image: "/images/materials/solid.jpg", bullets: ["Durable", "Premium finish"] },
  { id: "plywood", label: "Plywood", image: "/images/materials/ply.jpg", bullets: ["Moisture resistant", "Affordable"] }
];

const FINISHES = [
  { id: "matte", label: "Matte", image: "/images/finish/matte.jpg", bullets: ["Subtle", "Low-reflective"] },
  { id: "gloss", label: "Gloss", image: "/images/finish/gloss.jpg", bullets: ["Shiny", "Contemporary"] },
  { id: "veneer", label: "Veneer", image: "/images/finish/veneer.jpg", bullets: ["Wood look", "Warm"] }
];

export default function WardrobeEnquiry() {
  // Left-panel selections
  const [wardrobeType, setWardrobeType] = useState(null);
  const [material, setMaterial] = useState(null);
  const [finish, setFinish] = useState(null);

  // length radio (number feet)
  const [lengthFt, setLengthFt] = useState(2);

  // form (right panel)
  const [form, setForm] = useState({ email: "", type: "", area: "", city: "" });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // login modal control
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // progress steps (optional single-step for wardrobe or keep same layout)
  const steps = [{ key: "wtype", label: "Wardrobe Type" }, { key: "material", label: "Material" }, { key: "finish", label: "Finish" }];
  const [activeStep, setActiveStep] = useState(0);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  function findLabel(list, id) {
    const it = list.find((x) => x.id === id);
    return it ? it.label : id;
  }

  // actual POST to /api/wardrobe_enquiries
  async function doSubmit(userId = null) {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const uid = userId || storedUser.id || null;

    const payload = {
      user_id: uid,
      type: "wardrobe",
      email: form.email || null,
      city: form.city || null,
      length: lengthFt ?? null,
      wardrobe_type: wardrobeType ? findLabel(WARDROBE_TYPES, wardrobeType) : null,
      material: material ? findLabel(MATERIALS, material) : null,
      finish: finish ? findLabel(FINISHES, finish) : null
    };

    try {
      setLoading(true);
      setMessage(null);

      const res = await fetch("/api/wardrobe_enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");

      setMessage({ type: "success", text: "Wardrobe enquiry saved successfully" });
      // reset
      setForm({ email: "", area: "", city: "" });
      setWardrobeType(null);
      setMaterial(null);
      setFinish(null);
      setLengthFt(2);
      setActiveStep(0);
    } catch (err) {
      console.error("wardrobe submit failed:", err);
      setMessage({ type: "error", text: err.message || "Submit failed" });
    } finally {
      setLoading(false);
      setPendingSubmit(false);
    }
  }

  // Submit handler: Option B — open login modal immediately if user not logged in
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
      setPendingSubmit(true);
      setShowLoginModal(true);
      return;
    }

    // submit now
    await doSubmit(userId);
  }

  // called by PhoneLoginModal after successful login; may pass userObj
  function handleLoginSuccess(userObj = null) {
    setShowLoginModal(false);
    const userId = userObj?.id || JSON.parse(localStorage.getItem("user") || "{}").id || null;

    if (pendingSubmit) {
      // allow auth flow to persist localStorage
      setTimeout(() => doSubmit(userId), 250);
    }
  }

  return (
    <div className="home-enquiry-page wide-left">
      <div className="left-panel">

        <h3>Wardrobe Options</h3>

        <div className="progress-bar" style={{ marginBottom: 12 }}>
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
            <OptionGroup
              title="Wardrobe Type"
              options={WARDROBE_TYPES}
              multi={false}
              selected={wardrobeType}
              onChange={setWardrobeType}
            />
          )}

          {activeStep === 1 && (
            <OptionGroup
              title="Material"
              options={MATERIALS}
              multi={false}
              selected={material}
              onChange={setMaterial}
            />
          )}

          {activeStep === 2 && (
            <OptionGroup
              title="Finish"
              options={FINISHES}
              multi={false}
              selected={finish}
              onChange={setFinish}
            />
          )}

          <div className="step-nav" style={{ marginTop: 14 }}>
            <button type="button" className="nav-btn" onClick={() => setActiveStep((s) => Math.max(0, s - 1))} disabled={activeStep === 0}>
              Previous
            </button>
            <button type="button" className="nav-btn" onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))} disabled={activeStep === steps.length - 1}>
              Next
            </button>
          </div>
        </div>

        {/* length selection (radio buttons) */}
        <div style={{ marginTop: 18 }}>
          <h4 style={{ margin: "8px 0" }}>Length (ft)</h4>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const ft = i + 2; // 2..8
              return (
                <label key={ft} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="lengthFt"
                    value={ft}
                    checked={lengthFt === ft}
                    onChange={() => setLengthFt(ft)}
                  />
                  <span style={{ padding: "6px 10px", borderRadius: 8, border:"1px solid rgba(184, 162, 84, 0.845)" , color: lengthFt === "#111", fontWeight: 600 }}>
                    {ft} ft
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="right-panel narrow-form">
        <h2>Wardrobe Enquiry</h2>

        <form className="enquiry-form" onSubmit={handleSubmit}>
          <label>
            Email *
            <input name="email" value={form.email} onChange={handleFormChange} type="email" placeholder="you@example.com" />
          </label>

          <label>
            Area (sq ft)
            <input name="area" value={form.area} onChange={handleFormChange} type="number" />
          </label>

          <label>
            City
            <input name="city" value={form.city} onChange={handleFormChange} type="text" />
          </label>

          <div className="selected-summary" style={{ marginTop: 8 }}>
            {wardrobeType && <span className="chip">{findLabel(WARDROBE_TYPES, wardrobeType)}</span>}
            {material && <span className="chip">{findLabel(MATERIALS, material)}</span>}
            {finish && <span className="chip">{findLabel(FINISHES, finish)}</span>}
            {lengthFt && <span className="chip">{lengthFt} ft</span>}
          </div>

          <div className="form-actions" style={{ marginTop: 12 }}>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Saving..." : "Submit Enquiry"}
            </button>
          </div>

          {message && (
            <div className={`form-message ${message.type === "error" ? "error" : "success"}`} style={{ marginTop: 12 }}>
              {message.text}
            </div>
          )}
        </form>
      </div>

      {/* Phone login modal (Option B) */}
      {showLoginModal && (
        <PhoneLoginModal
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
