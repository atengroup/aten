// src/pages/WardrobeEnquiry.jsx
import React, { useState } from "react";
import OptionGroup from "../components/OptionGroup";
import styles from "../assets/pages/HomeEnquiry.module.css";
import EmailLoginModal from "../components/EmailLoginModal";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const RAW_BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || "";
const BACKEND_BASE = RAW_BACKEND_BASE.replace(/\/+$/, ""); // strip trailing slash
function buildUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!BACKEND_BASE) return p;
  return `${BACKEND_BASE}${p}`.replace(/([^:]\/)\/+/g, "$1");
}

const WARDROBE_TYPES = [
  { id: "slide", label: "Sliding", image: "sliding-w.webp", bullets: ["Space saving", "Modern look"] },
  { id: "swing", label: "Swing", image: "swing-w.webp", bullets: ["Traditional", "Full access"] }
];

const MATERIALS = [
  { id: "plywood", label: "Plywood", image: "ply.webp", bullets: ["Moisture resistant", "Affordable"] },
  { id: "engineered_wood", label: "Engineered Wood", image: "mdf.webp", bullets: ["Stable", "Cost-effective"] },
  { id: "hdhmr", label: "HDHMR", image: "hdhmr.webp", bullets: ["Durable", "Premium finish"] },
];

const FINISHES = [
  { id: "matte", label: "Laminate", image: "lam.webp", bullets: ["Subtle", "Low-reflective"] },
  { id: "gloss", label: "PVC", image: "pvc.webp", bullets: ["Shiny", "Contemporary"] },
  { id: "veneer", label: "Acrylic", image: "vineer.webp", bullets: ["Wood look", "Warm"] },
  { id: "duco", label: "Duco Paint", image: "duco.webp", bullets: ["Wood look", "Warm"] },
  { id: "pu", label: "PU Polish", image: "duco.webp", bullets: ["Wood look", "Warm"] },
];

export default function WardrobeEnquiry() {
  const [wardrobeType, setWardrobeType] = useState(null);
  const [material, setMaterial] = useState(null);
  const [finish, setFinish] = useState(null);
  const [lengthFt, setLengthFt] = useState(2);
  const navigate = useNavigate()
  // removed email and area from form state — only city remains
  const [form, setForm] = useState({ city: "" });

  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

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

  // doSubmit accepts optional userId and userObj; if not provided it reads from localStorage
  async function doSubmit(userId = null, userObj = null) {
    const storedUser = userObj || JSON.parse(localStorage.getItem("user") || "null") || JSON.parse(localStorage.getItem("user") || "{}");
    const uid = userId || (storedUser && (storedUser.id || storedUser.uid)) || null;
    const email = (storedUser && storedUser.email) || null;

    // payload no longer includes area; email is taken from user and sent like user_id
    const payload = {
      user_id: uid,
      email: email,
      type: "wardrobe",
      city: form.city || null,
      length: lengthFt ?? null,
      wardrobe_type: wardrobeType ? findLabel(WARDROBE_TYPES, wardrobeType) : null,
      material: material ? findLabel(MATERIALS, material) : null,
      finish: finish ? findLabel(FINISHES, finish) : null,
    };

    // defensive: ensure required fields are present before network call
    if (!payload.type) {
      toast.error("Enquiry type missing (internal)");
      return;
    }

    try {
      setLoading(true);

      const url = buildUrl("/api/wardrobe_enquiries");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || `Server error (${res.status})`;
        throw new Error(msg);
      }

      toast.success("Wardrobe enquiry saved successfully");

      // reset form fields
      setForm({ city: "" });
      setWardrobeType(null);
      setMaterial(null);
      setFinish(null);
      setLengthFt(2);
      setActiveStep(0);
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

    // require login so we can attach user_id and email
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = storedUser.id || null;

    if (!userId) {
      setPendingSubmit(true);
      setShowLoginModal(true);
      return;
    }

    await doSubmit(userId, storedUser);
  }

  // Wait-for-user helper: polls localStorage until a user object with id appears (or times out)
  function waitForPersistedUser(timeoutMs = 3000, intervalMs = 100) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        try {
          const raw = localStorage.getItem("user");
          if (raw) {
            const u = JSON.parse(raw);
            if (u && (u.id || u.uid)) return resolve(u);
          }
        } catch (e) {
          // ignore parse errors
        }
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(check, intervalMs);
      };
      check();
    });
  }

  async function handleLoginSuccess(userObj = null) {
    setShowLoginModal(false);

    // If modal provides user object, use that immediately.
    if (userObj && (userObj.id || userObj.uid)) {
      if (pendingSubmit) {
        await doSubmit(userObj.id || userObj.uid, userObj);
      }
      return;
    }

    // Otherwise wait for the auth flow to persist user into localStorage
    if (!pendingSubmit) return;
    const persisted = await waitForPersistedUser(3000, 100);
    const finalUser = persisted || JSON.parse(localStorage.getItem("user") || "{}");
    const uid = finalUser?.id || finalUser?.uid || null;

    if (!uid) {
      toast.error("Login completed but user not available — please refresh and try again.");
      setPendingSubmit(false);
      return;
    }

    // safe: call submit with the found user
    setTimeout(() => doSubmit(uid, finalUser), 150); // small extra delay so any last writes complete
  }

  return (
    <div className={`${styles.homeEnquiryPage} wide-left`}>
      <div className={styles.leftPanel}>
        <h3>Wardrobe Options</h3>

        <div className={styles.progressBar} style={{ marginBottom: 12 }}>
          {steps.map((s, idx) => {
            const completed = idx < activeStep;
            const active = idx === activeStep;
            return (
              <button key={s.key} type="button" className={`${styles.step} ${active ? styles.stepActive : completed ? styles.stepCompleted : ""}`} onClick={() => setActiveStep(idx)}>
                <div className={styles.stepIndex}>{idx + 1}</div>
                <div>{s.label}</div>
              </button>
            );
          })}
        </div>

        <div className="option-stage">
          {activeStep === 0 && <OptionGroup title="Wardrobe Type" options={WARDROBE_TYPES} multi={false} selected={wardrobeType} onChange={setWardrobeType} />}
          {activeStep === 1 && <OptionGroup title="Material" options={MATERIALS} multi={false} selected={material} onChange={setMaterial} />}
          {activeStep === 2 && <OptionGroup title="Finish" options={FINISHES} multi={false} selected={finish} onChange={setFinish} />}

          <div className={styles.stepNav} style={{ marginTop: 14 }}>
            <button type="button" className={styles.navBtn} onClick={() => setActiveStep((s) => Math.max(0, s - 1))} disabled={activeStep === 0}>Previous</button>
            <button type="button" className={styles.navBtn} onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))} disabled={activeStep === steps.length - 1}>Next</button>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <h4 style={{ margin: "8px 0" }}>Length (ft)</h4>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const ft = i + 2;
              return (
                <label key={ft} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input type="radio" name="lengthFt" value={ft} checked={lengthFt === ft} onChange={() => setLengthFt(ft)} />
                  <span style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--accent)", fontWeight: 600 }}>{ft} ft</span>
                </label>
              );
            })}
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
        <h2>Wardrobe Enquiry</h2>
        <form className={styles.enquiryForm} onSubmit={handleSubmit}>
          {/* Email & area removed from UI — email will be taken from logged-in user and sent in payload */}

          <label>
            City
            <input name="city" value={form.city} onChange={handleFormChange} type="text" />
          </label>

          <div className={styles.selectedSummary} style={{ marginTop: 8 }}>
            {wardrobeType && <span className={styles.chip}>{findLabel(WARDROBE_TYPES, wardrobeType)}</span>}
            {material && <span className={styles.chip}>{findLabel(MATERIALS, material)}</span>}
            {finish && <span className={styles.chip}>{findLabel(FINISHES, finish)}</span>}
            {lengthFt && <span className={styles.chip}>{lengthFt} ft</span>}
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? "Saving..." : "Submit Enquiry"}</button>
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
