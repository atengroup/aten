// src/pages/SubmitTestimonial.jsx
import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import "../assets/pages/SubmitTestimonial.css";
import Dropdown from "../components/Dropdown";
import { useNavigate, useLocation } from "react-router-dom";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

export default function SubmitTestimonial() {
  const [customerPhone, setCustomerPhone] = useState("");
  const [foundTestimonials, setFoundTestimonials] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    name: "",
    review: "",
    customer_type: "",
    service_type: "",
    rating: "",
    customer_image: "", // NOTE: canonical storage path (e.g., 'testimonials/..jpg')
    customer_phone: "",
  });

  const [preview, setPreview] = useState(""); // previewable absolute URL or blob URL
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef(null);

  function extractPhoneFromObject(obj) {
    if (!obj || typeof obj !== "object") return "";
    return (
      obj.customer_phone ||
      obj.phone ||
      obj.phoneNumber ||
      obj.phone_number ||
      obj.mobile ||
      obj.msisdn ||
      ""
    );
  }

  function getSavedCustomerPhone() {
    try {
      const direct = localStorage.getItem("customer_phone");
      if (direct && direct.trim()) return direct.trim();

      const keys = ["customer", "user", "user_info", "auth_user", "profile"];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const p = extractPhoneFromObject(parsed);
          if (p) return p;
        } catch (e) {
          if (raw && raw.trim() && /^[+\d]/.test(raw.trim())) return raw.trim();
        }
      }

      const fallback = localStorage.getItem("user_phone");
      if (fallback && fallback.trim()) return fallback.trim();

      return "";
    } catch (err) {
      console.warn("Could not read localStorage for phone", err);
      return "";
    }
  }

  useEffect(() => {
    const p = getSavedCustomerPhone();
    if (p) {
      setCustomerPhone(p);
      setForm((s) => ({ ...s, customer_phone: p }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function fetchUserTestimonials() {
      if (!customerPhone) {
        setFoundTestimonials([]);
        return;
      }
      try {
        const res = await fetch(`${BACKEND_BASE}/api/testimonials?customer_phone=${encodeURIComponent(customerPhone)}&limit=50`);
        if (!res.ok) {
          setFoundTestimonials([]);
          return;
        }
        const j = await res.json();
        // Now testimonials have `customer_image_url` from server
        const arr = j.items || j || [];
        setFoundTestimonials(arr || []);
      } catch (err) {
        console.error("fetch user testimonials error", err);
        setFoundTestimonials([]);
      }
    }
    fetchUserTestimonials();
  }, [customerPhone]);

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) {
        try { URL.revokeObjectURL(preview); } catch (e) {}
      }
    };
  }, [preview]);

  // Upload handler: upload file to server; server returns { path, signedUrl, publicUrl }
  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }

    // Show local preview immediately
    const localBlob = URL.createObjectURL(file);
    if (preview && preview.startsWith("blob:")) {
      try { URL.revokeObjectURL(preview); } catch (e) {}
    }
    setPreview(localBlob);

    const fd = new FormData();
    fd.append("image", file);
    toast.loading("Uploading image...", { id: "user-up" });
    setUploading(true);

    try {
      const res = await fetch(`${BACKEND_BASE}/api/upload-testimonial-image`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || j?.message || "Upload failed");

      // server returns: { path, publicUrl, signedUrl }
      const path = j.path || null;
      const signedUrl = j.signedUrl || null;
      const publicUrl = j.publicUrl || null;

      if (!path) {
        throw new Error("Server did not return storage path for uploaded image");
      }

      // prefer signedUrl for immediate preview, fallback to publicUrl
      const previewUrl = signedUrl || publicUrl || null;

      // set canonical path in form (store this in DB) and set preview to the usable URL
      setForm((f) => ({ ...f, customer_image: path }));
      if (previewUrl) {
        setPreview(previewUrl);
      } else {
        // fallback: if server didn't give usable absolute url, try build absolute from path
        try {
          const built = new URL(path, BACKEND_BASE || window.location.origin).toString();
          setPreview(built);
        } catch (err) {
          // leave the local blob preview if nothing else
        }
      }

      toast.success("Image uploaded", { id: "user-up" });
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.message || "Image upload failed", { id: "user-up" });
    } finally {
      // revoke local blob (we replaced or will replace preview)
      if (localBlob && localBlob.startsWith("blob:")) {
        try { URL.revokeObjectURL(localBlob); } catch (e) {}
      }
      setUploading(false);
    }
  }

  function removeImage() {
    if (preview && preview.startsWith("blob:")) {
      try { URL.revokeObjectURL(preview); } catch (e) {}
    }
    setPreview("");
    setForm((f) => ({ ...f, customer_image: "" }));
    if (fileRef.current) fileRef.current.value = null;
  }

  useEffect(() => {
    if (!form.service_type) {
      setEditingId(null);
      return;
    }
    const found = (foundTestimonials || []).find(
      (t) =>
        String(t.service_type || "") === String(form.service_type) &&
        String(t.customer_phone || t.phone || "") === String(customerPhone)
    );

    if (found) {
      setEditingId(found.id || found._id || null);
      setForm({
        name: found.name || "",
        review: found.review || "",
        customer_type: found.customer_type || "",
        service_type: found.service_type || form.service_type,
        rating: found.rating != null ? String(found.rating) : "",
        customer_image: found.customer_image || "", // canonical path
        customer_phone: customerPhone,
      });
      // preview uses server-supplied customer_image_url (GET returned it)
      setPreview(found.customer_image_url || found.customer_image || "");
    } else {
      setEditingId(null);
      setForm((s) => ({ ...s, customer_phone: customerPhone }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.service_type, foundTestimonials, customerPhone]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!customerPhone) {
      toast.error("Please login before submitting (customer_phone missing).");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!form.service_type) {
      toast.error("Please select a service type.");
      return;
    }
    const ratingNum = parseInt(form.rating, 10);
    if (!form.rating.toString().trim() || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      toast.error("Please provide a rating between 1 and 5.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: String(form.name).trim(),
        review: form.review ? String(form.review).trim() : "",
        customer_type: form.customer_type ? String(form.customer_type).trim() : "",
        service_type: String(form.service_type),
        rating: ratingNum,
        // IMPORTANT: we send canonical storage path (not signedUrl) so server stores non-expiring reference
        customer_image: form.customer_image ? String(form.customer_image).trim() : "",
        customer_phone: customerPhone,
      };

      let res;
      if (editingId) {
        res = await fetch(`${BACKEND_BASE}/api/testimonials/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${BACKEND_BASE}/api/testimonials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      toast.success(editingId ? "Testimonial updated" : "Thank you for your testimonial!");

      // refresh user's testimonials list
      const refresh = await fetch(`${BACKEND_BASE}/api/testimonials?customer_phone=${encodeURIComponent(customerPhone)}&limit=50`);
      if (refresh.ok) {
        const body = await refresh.json().catch(() => ({}));
        setFoundTestimonials(body.items || body || []);
      }

      if (!editingId) {
        setForm({
          name: "",
          review: "",
          customer_type: "",
          service_type: "",
          rating: "",
          customer_image: "",
          customer_phone: customerPhone,
        });
        setPreview("");
        if (fileRef.current) fileRef.current.value = null;
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Submit failed");
    } finally {
      setLoading(false);
    }
  };

  const needLogin = !customerPhone;
  const serviceTypeLocked = Boolean(editingId);

  const handleQuickLogin = () => {
    navigate("/login", { state: { from: location } });
  };

  return (
    <div className="test-page">
      <div className="testimonial-submit-container improved">
        <div className="card-head">
          <h2>Share Your Experience</h2>
          <p className="subtitle">Your words inspire other home-seekers.</p>
        </div>

        {needLogin && (
          <div className="login-prompt" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="upload-btn-gold btn-block" onClick={handleQuickLogin}>
                Quick login
              </button>
            </div>
          </div>
        )}

        {!needLogin && (
          <form className="testimonial-form" onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 10, fontSize: 13, color: "#333" }}>
              Logged in as <strong>{customerPhone}</strong>{" "}
            </div>

            <div className="row">
              <label htmlFor="name">Name <span style={{ color: "#c00" }}>*</span></label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
              />
            </div>

            <div className="form-row">
              <div>
                <label htmlFor="customer_type">Customer Type</label>
                <input
                  id="customer_type"
                  value={form.customer_type}
                  onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
                  placeholder="Homeowner, Investor..."
                />
              </div>

              <div>
                <label htmlFor="rating">Rating <span style={{ color: "#c00" }}>*</span></label>
                <div className="rating-wrap">
                  <input
                    id="rating"
                    type="number"
                    value={form.rating}
                    onChange={(e) => setForm({ ...form, rating: e.target.value })}
                    min="1"
                    max="5"
                    placeholder="4"
                    required
                  />
                  <div className="rating-hint">/5</div>
                </div>
              </div>
            </div>

            <div className="row">
              <label htmlFor="review">Testimonial</label>
              <textarea
                id="review"
                value={form.review}
                onChange={(e) => setForm({ ...form, review: e.target.value })}
                placeholder="Write your experience..."
              />
            </div>

            <div className="row">
              <label htmlFor="service_type">Service Type <span style={{ color: "#c00" }}>*</span></label>
              <div style={{ maxWidth: 360 }}>
                <Dropdown
                  id="service_type"
                  options={[
                    { value: "interio", label: "Interio" },
                    { value: "realty", label: "Realty" },
                    { value: "engineering", label: "Engineering" },
                  ]}
                  value={form.service_type}
                  onChange={(v) => {
                    if (serviceTypeLocked) {
                      toast("You cannot change service type for this testimonial. Choose another service to add a different testimonial.");
                      return;
                    }
                    setForm((s) => ({ ...s, service_type: v }));
                  }}
                  placeholder="-- Select service type --"
                />
              </div>
            </div>

            <div className="row">
              <label>Upload Your Image</label>

              <div className="file-input-row improved-row">
                <input
                  id="user_image"
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                />

                <button
                  type="button"
                  className={`upload-btn-gold btn-block ${uploading ? "disabled" : ""}`}
                  onClick={() => fileRef.current && fileRef.current.click()}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload Image"}
                </button>

                {preview ? (
                  <div className="preview-block">
                    <img src={preview} className="testimonial-upload-preview" alt="uploaded preview" />
                    <button type="button" className="remove-image" onClick={removeImage}>Remove</button>
                  </div>
                ) : (
                  <div className="preview-placeholder">No image uploaded</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 8, fontSize: 13, color: "#333" }}>
              {editingId
                ? "You're editing your testimonial for this service. To add a testimonial for a different service, choose another service from the dropdown."
                : "You can submit a new testimonial for the selected service type."}
            </div>

            <div className="actions-row" style={{ marginTop: 12 }}>
              <button className="submit-btn" disabled={loading}>
                {loading ? (editingId ? "Updating..." : "Submitting...") : (editingId ? "Update Testimonial" : "Submit Testimonial")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
