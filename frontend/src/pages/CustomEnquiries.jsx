// src/pages/CustomEnquiry.jsx
import React, { useState } from "react";
import styles from "../assets/pages/HomeEnquiry.module.css";
import toast from "react-hot-toast";
import EmailLoginModal from "../components/EmailLoginModal";

const RAW_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || "";
const BACKEND_BASE = RAW_BACKEND_BASE.replace(/\/+$/, "");
function buildUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!BACKEND_BASE) return p;
  return `${BACKEND_BASE}${p}`.replace(/([^:]\/)\/+/g, "$1");
}

export default function CustomEnquiry() {
  // email removed — comes from logged-in user
  const [form, setForm] = useState({ type: "", area: "", city: "" });
  const [customMessage, setCustomMessage] = useState("");

  const [loading, setLoading] = useState(false);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  async function doSubmit(userObj = null) {
    const stored = userObj || JSON.parse(localStorage.getItem("user") || "{}");
    const uid = stored?.id || null;
    const email = stored?.email || null;

    const payload = {
      user_id: uid,
      email: email || null,
      type: form.type,
      city: form.city || null,
      area: form.area || null,
      message: customMessage || null,
    };

    try {
      setLoading(true);

      const res = await fetch(buildUrl("/api/custom_enquiries"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Server error");

      toast.success("Custom enquiry saved successfully")

      // reset fields
      setForm({ type: "", area: "", city: "" });
      setCustomMessage("");
    } catch (err) {
      console.error(err);
      toast.error("Submit failed")
    } finally {
      setLoading(false);
      setPendingSubmit(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // TYPE is mandatory and TYPED IN
    if (!form.type.trim()) {
      toast.error("Please type the project type (required)");
      return;
    }

    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser.id || null;

    if (!userId) {
      setPendingSubmit(true);
      setShowLoginModal(true);
      return;
    }

    await doSubmit();
  }

  function handleLoginSuccess(userObj = null) {
    setShowLoginModal(false);
    const stored = userObj || JSON.parse(localStorage.getItem("user") || "{}");

    if (pendingSubmit) {
      setTimeout(() => doSubmit(stored), 200);
    }
  }

  return (
    <div className={`${styles.homeEnquiryPage} wide-left`}>
      <div className={styles.leftPanel}>
        <h3>Custom / Commercial Enquiry</h3>
        <p style={{ marginTop: 6, marginBottom: 10, color: "#374151", fontSize: 14 }}>
          Tell us about your commercial interior design requirements.
        </p>

        <label style={{ display: "block", marginTop: 6 }}>
          Project details
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Describe the project..."
            rows={10}
            style={{
              width: "100%",
              marginTop: 8,
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.08)",
              fontSize: 15,
              resize: "vertical",
            }}
          />
        </label>
      </div>

      <div className={styles.rightPanel}>
        <h2>Custom Enquiry</h2>
        <form className={styles.enquiryForm} onSubmit={handleSubmit}>

          {/* REQUIRED TEXT FIELD */}
          <label>
            Project Type *
            <input
              name="type"
              value={form.type}
              onChange={handleFormChange}
              type="text"
              placeholder="E.g. Office interior, Retail shop, Restaurant, etc."
            />
          </label>

          <label>
            Area (sq ft)
            <input
              name="area"
              value={form.area}
              onChange={handleFormChange}
              type="number"
            />
          </label>

          <label>
            City
            <input
              name="city"
              value={form.city}
              onChange={handleFormChange}
              type="text"
            />
          </label>

          <div style={{ marginTop: 12 }}>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Saving..." : "Submit Enquiry"}
            </button>
          </div>

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
