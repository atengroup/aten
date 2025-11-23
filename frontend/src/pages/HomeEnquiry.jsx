// File: src/pages/HomeEnquiry.jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import OptionGroup from "../components/OptionGroup";
import "../assets/pages/HomeEnquiry.css";
import toast from "react-hot-toast";
import Dropdown from "../components/Dropdown";

// -- add (or restore) these in src/pages/HomeEnquiry.jsx near the top --

const THEMES = [
  { id: "modern", label: "Modern", image: "/bathroom1.jpg", bullets: ["Clean lines", "Neutral palette"] },
  { id: "minimal", label: "Minimal", image: "/bathroom1.jpg", bullets: ["Less is more", "Open spaces"] },
  { id: "traditional", label: "Traditional", image: "/images/themes/traditional.jpg", bullets: ["Warm woods", "Classic details"] },
];

const KITCHENS = [
  { id: "open", label: "Open", image: "/images/kitchens/open.jpg", bullets: ["Integrated living", "Social layout"] },
  { id: "closed", label: "Closed", image: "/images/kitchens/closed.jpg", bullets: ["Odour control", "Defined zones"] },
  { id: "island", label: "Island", image: "/images/kitchens/island.jpg", bullets: ["Extra prep space", "Casual seating"] },
  { id: "lshape", label: "L-shaped", image: "/images/kitchens/lshape.jpg", bullets: ["Efficient flow", "Flexible layout"] },
  { id: "galley", label: "Galley", image: "/images/kitchens/galley.jpg", bullets: ["Compact", "Works well for small homes"] },
];

const MATERIALS = [
  { id: "laminate", label: "Laminate", image: "/images/materials/laminate.jpg", bullets: ["Budget friendly", "Wide colours"] },
  { id: "veneer", label: "Veneer", image: "/images/materials/veneer.jpg", bullets: ["Natural look", "Cost-effective"] },
  { id: "solidwood", label: "Solid Wood", image: "/images/materials/wood.jpg", bullets: ["Durable", "Ages well"] },
  { id: "mdf", label: "MDF", image: "/images/materials/mdf.jpg", bullets: ["Smooth finish", "Good for paint"] },
  { id: "acrylic", label: "Acrylic", image: "/images/materials/acrylic.jpg", bullets: ["High gloss", "Contemporary" ] },
];

const TYPE_OPTIONS = [
  { value: "1BHK", label: "1 BHK" },
  { value: "2BHK", label: "2 BHK" },
  { value: "3BHK", label: "3 BHK" },
  { value: "4BHK", label: "4 BHK" },
  { value: "4+ BHK", label: "4+ BHK" },
  { value: "studio", label: "Studio" }
];


// other data (THEMES, MATERIALS, KITCHENS) same as before...

export default function HomeEnquiry() {
  const params = useParams();          // ← GET URL PARAM
  const preSelectedType = params.type; // example: "2BHK"

  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedKitchen, setSelectedKitchen] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState([]);

  const [extraBhk, setExtraBhk] = useState("");   // <-- NEW FIELD FOR CUSTOM BHK

  const [form, setForm] = useState({
    email: "",
    type: "",
    area: "",
    bathroom_number: "",
    city: "",
  });

  useEffect(() => {
    if (preSelectedType) {
      let norm = preSelectedType.toUpperCase().replace(/\s+/g, "");

      // Accept "4+BHK" or "4plus" from URL
      if (norm === "4+BHK" || norm === "4PLUS" || norm === "4PLUSBHK") {
        setForm((f) => ({ ...f, type: "4+ BHK" }));
      } else {
        setForm((f) => ({ ...f, type: norm }));
      }
    }
  }, [preSelectedType]);

  const [loading, setLoading] = useState(false);

  const steps = [
    { key: "theme", label: "Theme" },
    { key: "kitchen", label: "Kitchen type" },
    { key: "material", label: "Material" },
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

  function goNext() {
    setActiveStep((s) => Math.min(steps.length - 1, s + 1));
  }
  function goPrev() {
    setActiveStep((s) => Math.max(0, s - 1));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.email.trim()) {
      toast.error("Please enter email");
      return;
    }

    let finalType = form.type;

    // if 4+ BHK → override with exact number
    if (form.type === "4+ BHK") {
      if (!extraBhk.trim()) {
        toast.error("Please enter exact BHK for 4+ homes");
        return;
      }
      finalType = `${extraBhk}BHK`;
    }

    const userObj = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = userObj.id || null;

    const payload = {
      user_id: userId,
      email: form.email,
      city: form.city,
      type: finalType,
      bathroom_number: form.bathroom_number || null,
      kitchen_type: selectedKitchen ? findLabel(KITCHENS, selectedKitchen) : null,
      material: selectedMaterials.map((m) => findLabel(MATERIALS, m)).join(", ") || null,
      area: form.area || null,
      theme: selectedTheme ? findLabel(THEMES, selectedTheme) : null,
    };

    try {
      setLoading(true);
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");

      toast.success("Enquiry submitted!");
    } catch (err) {
      toast.error("Failed to submit enquiry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="home-enquiry-page wide-left">
      <div className="left-panel">
        <h3>Choose options</h3>

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
            <OptionGroup title="Theme" options={THEMES} multi={false} selected={selectedTheme} onChange={setSelectedTheme} />
          )}
          {activeStep === 1 && (
            <OptionGroup title="Kitchen type" options={KITCHENS} multi={false} selected={selectedKitchen} onChange={setSelectedKitchen} />
          )}
          {activeStep === 2 && (
            <OptionGroup title="Material" options={MATERIALS} multi={true} selected={selectedMaterials} onChange={setSelectedMaterials} />
          )}

          <div className="step-nav">
            <button type="button" className="nav-btn" onClick={goPrev} disabled={activeStep === 0}>Previous</button>
            <button type="button" className="nav-btn" onClick={goNext} disabled={activeStep === steps.length - 1}>Next</button>
          </div>
        </div>
      </div>

      <div className="right-panel narrow-form">
        <h2>Home Enquiry</h2>
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
            Type *
            <Dropdown
              id="type"
              options={TYPE_OPTIONS}
              value={form.type || ""}
              onChange={(val) => {
                setForm((s) => ({ ...s, type: val }));
                if (val !== "4+ BHK") setExtraBhk("");
              }}
              placeholder="Select BHK type"
            />
          </label>

          {/* NEW EXTRA FIELD FOR 4+ BHK */}
          {form.type === "4+ BHK" && (
            <label>
              Enter exact BHK count *
              <input
                type="number"
                min="5"
                placeholder="e.g. 5"
                value={extraBhk}
                onChange={(e) => setExtraBhk(e.target.value)}
              />
            </label>
          )}

          <label>
            Area (sq ft)
            <input name="area" value={form.area} onChange={handleFormChange} type="number" />
          </label>

          <label>
            Number of bathrooms
            <input
              name="bathroom_number"
              value={form.bathroom_number}
              onChange={handleFormChange}
              type="number"
              min="0"
            />
          </label>

          <label>
            City
            <input name="city" value={form.city} onChange={handleFormChange} type="text" />
          </label>

          <div className="selected-summary">
            {selectedTheme && <span className="chip">{findLabel(THEMES, selectedTheme)}<button className="chip-remove" onClick={() => setSelectedTheme(null)}>×</button></span>}
            {selectedKitchen && <span className="chip">{findLabel(KITCHENS, selectedKitchen)}<button className="chip-remove" onClick={() => setSelectedKitchen(null)}>×</button></span>}
            {selectedMaterials.map((m) => (
              <span key={m} className="chip">{findLabel(MATERIALS, m)}<button className="chip-remove" onClick={() => setSelectedMaterials(selectedMaterials.filter(x => x !== m))}>×</button></span>
            ))}
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Saving..." : "Submit Enquiry"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
