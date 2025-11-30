// src/pages/HomeEnquiry.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import OptionGroup from "../components/OptionGroup";
import EmailLoginModal from "../components/EmailLoginModal";
import styles from "../assets/pages/HomeEnquiry.module.css";
import toast from "react-hot-toast";
import Dropdown from "../components/Dropdown";

// Vite backend base (safe handling)
const RAW_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || "";
const BACKEND_BASE = RAW_BACKEND_BASE.replace(/\/+$/, ""); // strip trailing slash
function buildUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!BACKEND_BASE) return p;
  return `${BACKEND_BASE}${p}`.replace(/([^:]\/)\/+/g, "$1");
}

const THEMES = [
  { id: "modern", label: "Modern", image: "/modern-cozy.webp", bullets: ["Clean lines", "Neutral palette"] },
  { id: "minimal", label: "Minimal", image: "/living-i3.webp", bullets: ["Less is more", "Open spaces"] },
  { id: "traditional", label: "Traditional", image: "/bedroom-i3.webp", bullets: ["Warm woods", "Classic details"] },
];


const TYPE_OPTIONS = [
  { value: "1BHK", label: "1 BHK" },
  { value: "2BHK", label: "2 BHK" },
  { value: "3BHK", label: "3 BHK" },
  { value: "4BHK", label: "4 BHK" },
  { value: "4+ BHK", label: "4+ BHK" },
  { value: "studio", label: "Studio" }
];

export default function HomeEnquiry() {
  const params = useParams();
  const preSelectedType = params.type;
  const navigate = useNavigate()
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedKitchen, setSelectedKitchen] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState([]);

  const [extraBhk, setExtraBhk] = useState("");
  // removed email from form state (email will be taken from logged-in user)
  const [form, setForm] = useState({ type: "", area: "", bathroom_number: "", city: "" });

  useEffect(() => {
    if (preSelectedType) {
      let norm = preSelectedType.toUpperCase().replace(/\s+/g, "");
      if (norm === "4+BHK" || norm === "4PLUS" || norm === "4PLUSBHK") {
        setForm((f) => ({ ...f, type: "4+ BHK" }));
      } else {
        setForm((f) => ({ ...f, type: norm }));
      }
    }
  }, [preSelectedType]);

  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const steps = [
    { key: "theme", label: "Theme" }
  ];
  const [activeStep, setActiveStep] = useState(0);

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

  // doSubmit accepts optional userId (UUID). If not provided, it will attempt to read it from localStorage.
  async function doSubmit(userId = null) {
    // validate 4+ BHK case
    let finalType = form.type;
    if (form.type === "4+ BHK") {
      if (!extraBhk.trim()) {
        toast.error("Please enter exact BHK for 4+ homes");
        return;
      }
      finalType = `${extraBhk}BHK`;
    }

    // fallback to stored user if userId not provided
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const finalUserId = userId || storedUser.id || null;
    const finalEmail = storedUser.email || null;

    const payload = {
      user_id: finalUserId,
      email: finalEmail,
      city: form.city || null,
      type: finalType,
      bathroom_number: form.bathroom_number || null,
      area: form.area || null,
      theme: selectedTheme ? findLabel(THEMES, selectedTheme) : null,
    };

    try {
      setLoading(true);
      const url = buildUrl("/api/enquiries");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Server error (${res.status})`);

      toast.success("Enquiry submitted!");
      // reset form (email removed so not clearing it)
      setForm({ type: "", area: "", bathroom_number: "", city: "" });
      setSelectedTheme(null);
      setSelectedKitchen(null);
      setSelectedMaterials([]);
      setExtraBhk("");
    } catch (err) {
      console.error("submit error:", err);
      toast.error(err?.message || "Failed to submit enquiry");
    } finally {
      setLoading(false);
      setPendingSubmit(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // email field removed — no longer required from UI
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser.id || null;

    if (!userId) {
      // not logged in -> prompt login modal and remember to submit after login
      setPendingSubmit(true);
      setShowLoginModal(true);
      return;
    }

    await doSubmit(userId);
  }

  // Called by EmailLoginModal when login completes successfully.
  // The modal may pass back the server user object (userObj) — if it does we use it directly,
  // otherwise we read localStorage (login flow persists server user there).
  function handleLoginSuccess(userObj = null) {
    setShowLoginModal(false);

    // prefer the user object passed by modal; fallback to localStorage
    const userId =
      (userObj && (userObj.id || userObj.uid)) ? (userObj.id || userObj.uid) :
      (JSON.parse(localStorage.getItem("user") || "{}").id || null);

    if (pendingSubmit) {
      // tiny delay to allow login flow to finish persisting (defensive)
      setTimeout(() => doSubmit(userId), 200);
    }
  }

  return (
    <div className={`${styles.homeEnquiryPage} wide-left`}>
      <div className={styles.leftPanel}>
        <h3>Choose options</h3>

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
            <OptionGroup title="Theme" options={THEMES} multi={false} selected={selectedTheme} onChange={setSelectedTheme} />
          )}

          <div className={styles.stepNav}>
            <button type="button" className={styles.navBtn} onClick={() => goPrev()} disabled={activeStep === 0}>Previous</button>
            <button type="button" className={styles.navBtn} onClick={() => goNext()} disabled={activeStep === steps.length - 1}>Next</button>
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
        <h2>Home Enquiry</h2>
        <form className={styles.enquiryForm} onSubmit={handleSubmit}>
          {/* Email removed from UI — will be taken from logged-in user */}

          <label>
            Type *
            <Dropdown
              id="type"
              options={TYPE_OPTIONS}
              value={form.type || ""}
              onChange={(val) => { setForm((s) => ({ ...s, type: val })); if (val !== "4+ BHK") setExtraBhk(""); }}
              placeholder="Select BHK type"
            />
          </label>

          {form.type === "4+ BHK" && (
            <label>
              Enter exact BHK count *
              <input type="number" min="5" placeholder="e.g. 5" value={extraBhk} onChange={(e) => setExtraBhk(e.target.value)} />
            </label>
          )}

          <label>
            Area (sq ft)
            <input name="area" value={form.area} onChange={handleFormChange} type="number" />
          </label>

          <label>
            Number of bathrooms
            <input name="bathroom_number" value={form.bathroom_number} onChange={handleFormChange} type="number" min="0" />
          </label>

          <label>
            City
            <input name="city" value={form.city} onChange={handleFormChange} type="text" />
          </label>

          <div className={styles.selectedSummary}>
            {selectedTheme && <span className={styles.chip}>{findLabel(THEMES, selectedTheme)}<button className={styles.chipRemove} onClick={() => setSelectedTheme(null)}>×</button></span>}
            {selectedKitchen && <span className={styles.chip}>{findLabel(KITCHENS, selectedKitchen)}<button className={styles.chipRemove} onClick={() => setSelectedKitchen(null)}>×</button></span>}
            {selectedMaterials.map((m) => (
              <span key={m} className={styles.chip}>{findLabel(MATERIALS, m)}<button className={styles.chipRemove} onClick={() => setSelectedMaterials(selectedMaterials.filter(x => x !== m))}>×</button></span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? "Saving..." : "Submit Enquiry"}</button>
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
