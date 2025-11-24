// src/pages/CustomEnquiry.jsx
import React, { useState } from "react";
import Dropdown from "../components/Dropdown";
import PhoneLoginModal from "../components/PhoneLoginModal";
import styles from "../assets/pages/HomeEnquiry.module.css";
import toast from "react-hot-toast";
const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");
const TYPE_OPTIONS = [
  { value: "1BHK", label: "1 BHK" },
  { value: "2BHK", label: "2 BHK" },
  { value: "3BHK", label: "3 BHK" },
  { value: "4BHK", label: "4 BHK" },
  { value: "studio", label: "Studio" }
];

export default function CustomEnquiry() {
  const [form, setForm] = useState({ email: "", type: "", area: "", city: "" });
  const [customMessage, setCustomMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  async function doSubmit(userId = null) {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const uid = userId || storedUser.id || null;
    const payload = { user_id: uid, type: form.type || null, email: form.email || null, city: form.city || null, area: form.area || null, message: customMessage || null };
    try {
      setLoading(true); setMessage(null);
      const res = await fetch("${BACKEND_BASE}/api/custom_enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");
      setMessage({ type: "success", text: "Custom enquiry saved successfully" });
      setForm({ email: "", type: "", area: "", city: "" }); setCustomMessage("");
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Submit failed" });
    } finally {
      setLoading(false); setPendingSubmit(false);
    }
  }

  async function handleSubmit(e) {
    e && e.preventDefault();
    setMessage(null);
    if (!form.email || form.email.trim() === "") { setMessage({ type: "error", text: "Email is required" }); return; }
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser.id || null;
    if (!userId) { setPendingSubmit(true); setShowLoginModal(true); return; }
    await doSubmit(userId);
  }

  function handleLoginSuccess(userObj = null) {
    setShowLoginModal(false);
    const uid = userObj?.id || JSON.parse(localStorage.getItem("user") || "{}").id || null;
    if (pendingSubmit) setTimeout(() => doSubmit(uid), 200);
  }

  return (
    <div className={`${styles.homeEnquiryPage} wide-left`}>
      <div className={styles.leftPanel}>
        <h3>Custom / Commercial Enquiry</h3>
        <p style={{ marginTop: 6, marginBottom: 10, color: "#374151", fontSize: 14 }}>
          Tell us about your commercial interior design requirements. Include square footage, scope (flooring, partitions, MEP, lighting), timelines, and any references.
        </p>

        <label style={{ display: "block", marginTop: 6 }}>
          Project details
          <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Describe the project..." rows={10}
            style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", fontSize: 15, resize: "vertical" }} />
        </label>
      </div>

      <div className={styles.rightPanel}>
        <h2>Custom Enquiry</h2>
        <form className={styles.enquiryForm} onSubmit={handleSubmit}>
          <label>
            Email *
            <input name="email" value={form.email} onChange={handleFormChange} type="email" placeholder="you@example.com" />
          </label>

          <label>
            Type (project scale)
            <Dropdown id="custom-type" options={TYPE_OPTIONS} value={form.type || ""} onChange={(val) => setForm((s) => ({ ...s, type: val }))} placeholder="Select scale" />
          </label>

          <label>
            Area (sq ft)
            <input name="area" value={form.area} onChange={handleFormChange} type="number" />
          </label>

          <label>
            City
            <input name="city" value={form.city} onChange={handleFormChange} type="text" />
          </label>

          <div className={styles.selectedSummary} style={{ marginTop: 6 }}>
            {customMessage ? <span className={styles.chip}>Message added</span> : null}
            {form.type ? <span className={styles.chip}>{form.type}</span> : null}
            {form.area ? <span className={styles.chip}>{form.area} sq ft</span> : null}
            {form.city ? <span className={styles.chip}>{form.city}</span> : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? "Saving..." : "Submit Enquiry"}</button>
          </div>

          {message && (
            <div className={`${styles.formMessage} ${message.type === "error" ? styles.formMessageError : styles.formMessageSuccess}`} style={{ marginTop: 12 }}>
              {message.text}
            </div>
          )}
        </form>
      </div>

      {showLoginModal && <PhoneLoginModal onClose={() => { setShowLoginModal(false); setPendingSubmit(false); }} onSuccess={handleLoginSuccess} />}
    </div>
  );
}
