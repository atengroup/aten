// src/pages/admin/TestimonialsAdmin.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import "../../assets/pages/admin/TestimonialsAdmin.css";
import Dropdown from "../../components/Dropdown"; // Import Dropdown component
import { getImageUrl } from "../../lib/api";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

// Local test image (developer-provided). In production this will be replaced by real URLs.
const DEV_TEST_FALLBACK = "/mnt/data/5e09c9d2-abc3-4ff4-b971-e555efa5c499.png";

export default function TestimonialsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [serviceFilter, setServiceFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE}/api/testimonials?limit=1000`);
      if (!res.ok) throw new Error("Failed to fetch");
      const j = await res.json();
      setItems(j.items || j || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load testimonials");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    let t = (items || []).slice();
    if (serviceFilter) {
      t = t.filter((it) => String(it.service_type || "").toLowerCase() === String(serviceFilter).toLowerCase());
    }
    if (ratingFilter) {
      const rf = parseInt(ratingFilter, 10);
      if (!isNaN(rf)) {
        t = t.filter((it) => Math.round(Number(it.rating || 0)) === rf);
      }
    }
    t.sort((a, b) => {
      const A = new Date(a.created_at || 0).getTime();
      const B = new Date(b.created_at || 0).getTime();
      return B - A;
    });
    return t;
  }, [items, serviceFilter, ratingFilter]);

  async function updateTestimonial(id, patch) {
    try {
      const res = await fetch(`${BACKEND_BASE}/api/testimonials/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || j.message || "Update failed");
      toast.success("Updated");
      await load();
    } catch (err) {
      console.error("update error:", err);
      toast.error(err.message || "Update failed");
    }
  }

  const handleToggleHome = async (t) => {
    const newVal = !Boolean(t.isHome);
    if (newVal) {
      const currentHomeCount = (items || []).filter((it) => it.isHome || it.isHome === 1 || String(it.isHome) === "true").length;
      if (currentHomeCount >= 10) {
        toast.error("Cannot enable more than 10 testimonials on Home. Remove one first.");
        return;
      }
    }
    await updateTestimonial(t.id || t._id, { isHome: newVal ? 1 : 0 });
  };

  const handleSetPageToServiceType = async (t) => {
    const service = t.service_type;
    if (!service) {
      toast.error("Testimonial has no service_type. Cannot set page.");
      return;
    }

    const currentlySetToThis = String(t.page || "").toLowerCase() === String(service).toLowerCase();

    if (!currentlySetToThis) {
      const curCount = (items || []).filter((it) => String(it.page || "").toLowerCase() === String(service).toLowerCase()).length;
      if (curCount >= 10) {
        toast.error(`Cannot show more than 10 testimonials on the "${service}" page. Remove one first.`);
        return;
      }
      await updateTestimonial(t.id || t._id, { page: service });
    } else {
      // CLEAR page by sending explicit null — backend now respects this
      await updateTestimonial(t.id || t._id, { page: null });
    }
  };

  const displayPhone = (t) => t.customer_phone || t.phone || t.user_phone || "";

  // Build a safe absolute src for the avatar image.
  // Priority:
  // 1) t.customer_image_url (server-supplied signed/public URL)
  // 2) t.customer_image if it's already absolute
  // 3) build absolute URL using BACKEND_BASE + t.customer_image (if relative path)
  // 4) fallback to a dev test image file
  const buildImageSrc = (t) => {
    if (!t) return DEV_TEST_FALLBACK;
    // 1) server-provided resolved URL
    if (t.customer_image_url && /^https?:\/\//i.test(t.customer_image_url)) return t.customer_image_url;
    // 2) stored value
    if (t.customer_image) {
      if (/^https?:\/\//i.test(t.customer_image)) return t.customer_image;
      // try to construct via getImageUrl helper (handles /uploads prefixing)
      try {
        const maybe = getImageUrl(t.customer_image);
        if (maybe && /^https?:\/\//i.test(maybe)) return maybe;
      } catch (e) {
        // fallthrough
      }
      // fallback: combine with BACKEND_BASE
      try {
        // make sure we don't produce double slashes
        let p = String(t.customer_image || "").trim();
        if (p.startsWith("/")) p = p.slice(1);
        if (BACKEND_BASE) return `${BACKEND_BASE.replace(/\/$/, "")}/${p}`;
      } catch (e) {
        // ignore
      }
    }
    // final fallback
    return DEV_TEST_FALLBACK;
  };

  return (
    <div className="testimonials-admin improved-ui">
      <div className="ta-toolbar" style={{ alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ marginRight: 6 }}>Service Type:</label>
          <Dropdown
            options={[
              { value: "", label: "All" },
              { value: "interio", label: "Interio" },
              { value: "realty", label: "Realty" },
              { value: "engineering", label: "Engineering" },
            ]}
            value={serviceFilter}
            onChange={(v) => setServiceFilter(v)}
            placeholder="All"
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ marginRight: 6 }}>Rating:</label>
          <Dropdown
            options={[
              { value: "", label: "All" },
              { value: "5", label: "5" },
              { value: "4", label: "4" },
              { value: "3", label: "3" },
              { value: "2", label: "2" },
              { value: "1", label: "1" },
            ]}
            value={ratingFilter}
            onChange={(v) => setRatingFilter(v)}
            placeholder="All"
          />
        </div>

        <div style={{ marginLeft: "auto" }}>
          <button className="btn refresh" onClick={() => load()} disabled={loading}>⟲ Refresh</button>
        </div>
      </div>

      <div className="ta-list" style={{ marginTop: 12 }}>
        {loading ? (
          <div className="ta-empty">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="ta-empty">No testimonials found.</div>
        ) : (
          visible.map((t) => {
            const avatarSrc = buildImageSrc(t);
            return (
              <div key={t.id || t._id} className="ta-row" style={{ alignItems: "flex-start" }}>
                <div className="ta-left" style={{ flex: 1 }}>
                  <div className="ta-meta" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div className="ta-avatar" style={{ width: 56, height: 56, borderRadius: 6, overflow: "hidden", background: "#f2f2f2" }}>
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt={t.name || "avatar"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            // fallback to the dev test image if browser fails to load
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEV_TEST_FALLBACK;
                          }}
                        />
                      ) : (
                        <div className="ta-initial" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 18 }}>
                          {(t.name || "").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <div className="ta-name" style={{ fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: 13, color: "#666" }}>{t.customer_type || "—"}</div>
                        <div style={{ fontSize: 13, color: "#666" }}>{t.service_type ? `(${t.service_type})` : ""}</div>
                        <div style={{ fontSize: 12, color: "#999", marginLeft: "auto" }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}</div>
                      </div>

                      <div style={{ marginTop: 8, color: "#333" }} className="ta-review">{t.review}</div>

                      <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <strong style={{ fontSize: 13 }}>{t.rating ?? "—"}</strong>
                          <div style={{ display: "flex", gap: 4 }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < (t.rating || 0) ? "#a88441" : "none"} stroke="#a88441" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 .587l3.668 7.431L23.6 9.753l-5.8 5.654L19.335 24 12 19.897 4.665 24l1.535-8.593L.4 9.753l7.932-1.735z"/>
                              </svg>
                            ))}
                          </div>
                        </div>

                        {displayPhone(t) ? <div style={{ fontSize: 13, color: "#666" }}>📞 {displayPhone(t)}</div> : null}
                        {t.page ? <div style={{ fontSize: 12, color: "#0b7a66", border: "1px solid #e6f3ef", padding: "2px 8px", borderRadius: 6 }}>{t.page}</div> : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ta-right" style={{ minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      className={`btn ${t.isHome ? "" : "ghost"}`}
                      onClick={() => handleToggleHome(t)}
                      title={t.isHome ? "Remove from Home" : "Show on Home"}
                    >
                      {t.isHome ? "Home ✓" : "Home"}
                    </button>

                    <div style={{ width: 160 }}>
                      <button
                        className={`btn ${String(t.page || "").toLowerCase() === String(t.service_type || "").toLowerCase() ? "" : "ghost"}`}
                        onClick={() => handleSetPageToServiceType(t)}
                        title={t.service_type ? `Toggle show on ${t.service_type}` : "No service_type set"}
                      >
                        {String(t.page || "").toLowerCase() === String(t.service_type || "").toLowerCase() ? `Page: ${t.service_type} ✓` : `Set Page → ${t.service_type || "—"}`}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn danger small" onClick={() => {
                      if (!confirm("Delete this testimonial? This action cannot be undone.")) return;
                      fetch(`${BACKEND_BASE}/api/testimonials/${t.id || t._id}`, { method: "DELETE" })
                        .then(async (res) => {
                          if (!res.ok) throw new Error("Delete failed");
                          toast.success("Deleted");
                          await load();
                        })
                        .catch((err) => {
                          console.error(err);
                          toast.error("Delete failed");
                        });
                    }}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  function startEdit(item) {
    console.log("Admin edit requested for", item);
  }
}
