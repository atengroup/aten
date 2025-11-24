// src/pages/BathroomEnquiry.jsx
import React, { useState } from "react";
import OptionGroup from "../components/OptionGroup";
import PhoneLoginModal from "../components/PhoneLoginModal";
import styles from "../assets/pages/HomeEnquiry.module.css";
import toast from "react-hot-toast";
const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");
const BATHROOM_TYPES = [
  { id: "modern", label: "Modern", image: "/images/bathrooms/modern.jpg", bullets: ["Contemporary fixtures", "Clean lines"] },
  { id: "premium", label: "Premium", image: "/images/bathrooms/premium.jpg", bullets: ["Luxury finishes", "High-end fittings"] },
  { id: "smart", label: "Smart", image: "/images/bathrooms/smart.jpg", bullets: ["IoT enabled", "Automated controls"] }
];

export default function BathroomEnquiry() {
  const [selectedBathroomType, setSelectedBathroomType] = useState(null);
  const [form, setForm] = useState({ email: "", type: "", area: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  function handleFormChange(e) { const { name, value } = e.target; setForm((s) => ({ ...s, [name]: value })); }
  function findLabel(list, id) { const it = list.find((i) => i.id === id); return it ? it.label : id; }

  async function doSubmit(userId = null) {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const uid = userId || storedUser.id || null;
    const payload = { user_id: uid, type: "bathroom", email: form.email || null, city: form.city || null, area: form.area || null, bathroom_type: selectedBathroomType ? findLabel(BATHROOM_TYPES, selectedBathroomType) : null };
    try {
      setLoading(true); setMessage(null);
      const res = await fetch("${BACKEND_BASE}/api/kb_enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");
      toast.success("Bathroom enquiry saved successfully")
      setForm({ email: "", type: "", area: "", city: "" }); setSelectedBathroomType(null);
    } catch (err) { console.error(err); toast.error("Submit failed") ; }
    finally { setLoading(false); setPendingSubmit(false); }
  }

  async function handleSubmit(e) {
    e && e.preventDefault(); setMessage(null);
    if (!form.email || form.email.trim() === "") { toast.error("Email is required"); return; }
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

  return (
    <div className={`${styles.homeEnquiryPage} wide-left`}>
      <div className={styles.leftPanel}>
        <h3>Bathroom Options</h3>

        <div className={styles.progressBar}>
          <div className={`${styles.step} ${styles.stepActive}`}><div className={styles.stepIndex}>1</div><div>Bathroom Type</div></div>
        </div>

        <div className="option-stage">
          <OptionGroup title="Bathroom Type" options={BATHROOM_TYPES} multi={false} selected={selectedBathroomType} onChange={setSelectedBathroomType} />
        </div>
      </div>

      <div className={styles.rightPanel}>
        <h2>Bathroom Enquiry</h2>
        <form className={styles.enquiryForm} onSubmit={handleSubmit}>
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

          <div className={styles.selectedSummary} style={{ marginTop: 8 }}>
            {selectedBathroomType ? <span className={styles.chip}>{findLabel(BATHROOM_TYPES, selectedBathroomType)}</span> : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? "Saving..." : "Submit Enquiry"}</button>
          </div>

          
        </form>
      </div>

      {showLoginModal && <PhoneLoginModal onClose={() => { setShowLoginModal(false); setPendingSubmit(false); }} onSuccess={handleLoginSuccess} />}
    </div>
  );
}
