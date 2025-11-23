// File: src/pages/BathroomEnquiry.jsx
import React, { useState } from "react";
import OptionGroup from "../components/OptionGroup";
import PhoneLoginModal from "../components/PhoneLoginModal";
import "../assets/pages/HomeEnquiry.css"; // reuse the responsive CSS you already have

// decorative header image (user-uploaded file)
const HEADER_IMG = "/mnt/data/42b8911c-caea-4d06-8741-4f7cabe964e2.png";

const BATHROOM_TYPES = [
  { id: "modern", label: "Modern", image: "/images/bathrooms/modern.jpg", bullets: ["Contemporary fixtures", "Clean lines"] },
  { id: "premium", label: "Premium", image: "/images/bathrooms/premium.jpg", bullets: ["Luxury finishes", "High-end fittings"] },
  { id: "smart", label: "Smart", image: "/images/bathrooms/smart.jpg", bullets: ["IoT enabled", "Automated controls"] }
];

export default function BathroomEnquiry() {
  const [selectedBathroomType, setSelectedBathroomType] = useState(null);

  const [form, setForm] = useState({
    email: "",
    type: "", // 1BHK/2BHK/3BHK
    area: "",
    city: ""
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // for modal/login flow (Option B)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  function findLabel(list, id) {
    const it = list.find((i) => i.id === id);
    return it ? it.label : id;
  }

  // actual POST to kb_enquiries
  async function doSubmit(userId = null) {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const uid = userId || storedUser.id || null;

    const payload = {
      user_id: uid,
      type: "bathroom",
      email: form.email || null,
      city: form.city || null,
      area: form.area || null,
      bathroom_type: selectedBathroomType ? findLabel(BATHROOM_TYPES, selectedBathroomType) : null,
      kitchen_type: null,
      kitchen_theme: null
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

      setMessage({ type: "success", text: "Bathroom enquiry saved successfully" });

      // reset
      setForm({ email: "", type: "", area: "", city: "" });
      setSelectedBathroomType(null);
    } catch (err) {
      console.error("kb_enquiries submit failed:", err);
      setMessage({ type: "error", text: err.message || "Submit failed" });
    } finally {
      setLoading(false);
      setPendingSubmit(false);
    }
  }

  // main submit handler - Option B: open login modal immediately if not logged in
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

    await doSubmit(userId);
  }

  // called by PhoneLoginModal on success. It may pass back the user object.
  function handleLoginSuccess(userObj = null) {
    setShowLoginModal(false);
    const userId = userObj?.id || JSON.parse(localStorage.getItem("user") || "{}").id || null;

    if (pendingSubmit) {
      // small delay so auth flow has time to persist localStorage
      setTimeout(() => {
        doSubmit(userId);
      }, 200);
    }
  }

  return (
    <div className="home-enquiry-page wide-left">
      <div className="left-panel">
        {/* Decorative header (optional) */}

        <h3>Bathroom Options</h3>

        <div className="progress-bar">
          <div className="step active">
            <div className="step-index">1</div>
            <div className="step-label">Bathroom Type</div>
          </div>
        </div>

        <div className="option-stage">
          <OptionGroup
            title="Bathroom Type"
            options={BATHROOM_TYPES}
            multi={false}
            selected={selectedBathroomType}
            onChange={setSelectedBathroomType}
          />
        </div>
      </div>

      <div className="right-panel narrow-form">
        <h2>Bathroom Enquiry</h2>

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
            Type (e.g. 1BHK, 2BHK)
            <input name="type" value={form.type} onChange={handleFormChange} type="text" />
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
            {selectedBathroomType ? (
              <span className="chip">
                {findLabel(BATHROOM_TYPES, selectedBathroomType)}
                {/* no remove button here by default, but you can wire one to setSelectedBathroomType(null) */}
              </span>
            ) : null}
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
