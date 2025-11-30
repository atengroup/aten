// src/pages/BathroomEnquiry.jsx
import React, { useState } from "react";
import OptionGroup from "../components/OptionGroup";
import EmailLoginModal from "../components/EmailLoginModal";
import styles from "../assets/pages/HomeEnquiry.module.css";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const RAW_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || "";
const BACKEND_BASE = RAW_BACKEND_BASE.replace(/\/+$/, ""); // strip trailing slash
function buildUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!BACKEND_BASE) return p;
  return `${BACKEND_BASE}${p}`.replace(/([^:]\/)\/+/g, "$1");
}

const BATHROOM_TYPES = [
  { id: "modern", label: "Modern", image: "/bathroom-i2.webp", bullets: ["Contemporary fixtures", "Clean lines"] },
  { id: "premium", label: "Premium", image: "/premium-b.webp", bullets: ["Luxury finishes", "High-end fittings"] },
  { id: "smart", label: "Smart", image: "/smart-b.webp", bullets: ["IoT enabled", "Automated controls"] }
];

export default function BathroomEnquiry() {
  const [selectedBathroomType, setSelectedBathroomType] = useState(null);
  // removed email from form, it's fetched from logged-in user
  const [form, setForm] = useState({ type: "", area: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate()
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

  // doSubmit: accepts optional userObj or userId; prefers userObj if provided
  async function doSubmit(userObj = null) {
    const storedUser = userObj || JSON.parse(localStorage.getItem("user") || "null") || null;
    const uid = storedUser?.id || null;
    const email = storedUser?.email || null;

    const payload = {
      user_id: uid,
      type: "bathroom",
      email: email,
      city: form.city || null,
      area: form.area || null,
      bathroom_type: selectedBathroomType ? findLabel(BATHROOM_TYPES, selectedBathroomType) : null,
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
      if (!res.ok) {
        throw new Error(data?.error || `Server error (${res.status})`);
      }

      toast.success("Bathroom enquiry saved successfully");
      setForm({ type: "", area: "", city: "" });
      setSelectedBathroomType(null);
    } catch (err) {
      console.error("doSubmit error:", err);
      toast.error(err?.message || "Submit failed");
    } finally {
      setLoading(false);
      setPendingSubmit(false);
    }
  }

  async function handleSubmit(e) {
    e && e.preventDefault();
    setMessage(null);

    // email not required in UI anymore
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser.id || null;

    // if not logged in, request login and remember to submit after
    if (!userId) {
      setPendingSubmit(true);
      setShowLoginModal(true);
      return;
    }

    // user logged in -> submit with stored user (so email will also be included)
    await doSubmit();
  }

  // Called when EmailLoginModal completes successfully.
  // Modal may pass back the server user object as userObj; prefer that.
  function handleLoginSuccess(userObj = null) {
    setShowLoginModal(false);

    // prefer userObj returned by modal, else wait/read from localStorage
    const stored = userObj || JSON.parse(localStorage.getItem("user") || "null") || null;
    if (pendingSubmit) {
      // short delay to ensure login writes localStorage if modal didn't return userObj
      setTimeout(() => doSubmit(stored), 200);
    }
  }

  return (
    <div className={`${styles.homeEnquiryPage} wide-left`}>
      <div className={styles.leftPanel}>
        <h3>Bathroom Options</h3>

        <div className={styles.progressBar}>
          <div className={`${styles.step} ${styles.stepActive}`}>
            <div className={styles.stepIndex}>1</div>
            <div>Bathroom Type</div>
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

      <div className={styles.rightPanel}>
        <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate(-1)}
          >
            Back
          </button>
        <h2>Bathroom Enquiry</h2>
        <form className={styles.enquiryForm} onSubmit={handleSubmit}>
          {/* removed Email field from UI */}
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
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Saving..." : "Submit Enquiry"}
            </button>
          </div>
        </form>
      </div>

      {showLoginModal && (
        <EmailLoginModal
          onClose={() => { setShowLoginModal(false); setPendingSubmit(false); }}
          onSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
