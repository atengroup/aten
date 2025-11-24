// src/pages/admin/TestimonialsAdmin.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import styles from "../../assets/pages/admin/TestimonialsAdmin.module.css";
import Dropdown from "../../components/Dropdown";
import { getImageUrl } from "../../lib/api";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

// developer-provided local fallback (from conversation history)
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
      await updateTestimonial(t.id || t._id, { page: null });
    }
  };

  const displayPhone = (t) => t.customer_phone || t.phone || t.user_phone || "";

  const buildImageSrc = (t) => {
    if (!t) return DEV_TEST_FALLBACK;
    if (t.customer_image_url && /^https?:\/\//i.test(t.customer_image_url)) return t.customer_image_url;
    if (t.customer_image) {
      if (/^https?:\/\//i.test(t.customer_image)) return t.customer_image;
      try {
        const maybe = getImageUrl(t.customer_image);
        if (maybe && /^https?:\/\//i.test(maybe)) return maybe;
      } catch (e) {
        // ignore
      }
      try {
        let p = String(t.customer_image || "").trim();
        if (p.startsWith("/")) p = p.slice(1);
        if (BACKEND_BASE) return `${BACKEND_BASE.replace(/\/$/, "")}/${p}`;
      } catch (e) {
        // ignore
      }
    }
    return DEV_TEST_FALLBACK;
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <label htmlFor="serviceFilter">Service Type:</label>
          <div style={{ minWidth: 140 }}>
            <Dropdown
              id="serviceFilter"
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

          <label htmlFor="ratingFilter" style={{ marginLeft: 8 }}>Rating:</label>
          <div style={{ minWidth: 80 }}>
            <Dropdown
              id="ratingFilter"
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
        </div>

        <div className={styles.toolbarRight}>
          <button className={`${styles.btn} ${styles.btnRefresh}`} onClick={() => load()} disabled={loading}>⟲ Refresh</button>
        </div>
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.empty}>Loading…</div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>No testimonials found.</div>
        ) : (
          visible.map((t) => {
            const avatarSrc = buildImageSrc(t);
            return (
              <div key={t.id || t._id} className={styles.row}>
                <div className={styles.left}>
                  <div className={styles.meta}>
                    <div className={styles.avatar} aria-hidden>
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt={t.name || "avatar"}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEV_TEST_FALLBACK;
                          }}
                        />
                      ) : (
                        <div className={styles.initial}>{(t.name || "").charAt(0).toUpperCase()}</div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <div className={styles.name}>{t.name || "—"}</div>
                        <div className={styles.type}>{t.customer_type || "—"}</div>
                        <div className={styles.type}>{t.service_type ? `(${t.service_type})` : ""}</div>
                        <div style={{ fontSize: 12, color: "var(--muted-2)", marginLeft: "auto" }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}</div>
                      </div>

                      <div className={styles.review}>{t.review}</div>

                      <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <strong style={{ fontSize: 13 }}>{t.rating ?? "—"}</strong>
                          <div className={styles.stars} aria-hidden>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < (t.rating || 0) ? "var(--accent)" : "none"} stroke="var(--accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 .587l3.668 7.431L23.6 9.753l-5.8 5.654L19.335 24 12 19.897 4.665 24l1.535-8.593L.4 9.753l7.932-1.735z"/>
                              </svg>
                            ))}
                          </div>
                        </div>

                        {displayPhone(t) ? <div style={{ fontSize: 13, color: "var(--muted-2)" }}>📞 {displayPhone(t)}</div> : null}
                        {t.page ? <div style={{ fontSize: 12, color: "var(--btn-text)", background: "var(--accent)", padding: "2px 8px", borderRadius: 6 }}>{t.page}</div> : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.rightCol}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      className={`${styles.btn} ${t.isHome ? "" : styles.btnGhost}`}
                      onClick={() => handleToggleHome(t)}
                      title={t.isHome ? "Remove from Home" : "Show on Home"}
                    >
                      {t.isHome ? "Home ✓" : "Home"}
                    </button>

                    <div style={{ width: 160 }}>
                      <button
                        className={`${styles.btn} ${String(t.page || "").toLowerCase() === String(t.service_type || "").toLowerCase() ? "" : styles.btnGhost}`}
                        onClick={() => handleSetPageToServiceType(t)}
                        title={t.service_type ? `Toggle show on ${t.service_type}` : "No service_type set"}
                      >
                        {String(t.page || "").toLowerCase() === String(t.service_type || "").toLowerCase() ? `Page: ${t.service_type} ✓` : `Set Page → ${t.service_type || "—"}`}
                      </button>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`} onClick={() => {
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
}
