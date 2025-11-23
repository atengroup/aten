// InterioHome.jsx (patched)
import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import "../assets/pages/Home.css";
import { getImageUrl } from "../lib/api"; // <- use helper to prefix /uploads etc.

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

// Developer test fallback (local file you provided)
const DEV_TEST_FALLBACK = "/mnt/data/5e09c9d2-abc3-4ff4-b971-e555efa5c499.png";

const homeTypes = [
  {
    name: "INTERIO",
    path: "/interio",
    background: "/interiohome.jpg",
    description:
      "Beautiful, functional spaces crafted with modern design and comfort in mind.",
  },
  {
    name: "REALTY",
    path: "/projects",
    background: "/realtorhome.jpg",
    description:
      "Providing reliable property solutions and expert guidance for every home buyer and seller.",
  },
  {
    name: "ENGINEERING",
    path: "/catalog/3bhk",
    background: "/engineeringhome.jpg",
    description:
      "Delivering strong, sustainable, and efficient construction and structural solutions.",
  },
];

export default function InterioHome() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const trackRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${BACKEND_BASE}/api/testimonials?limit=1000`);
        if (!res.ok) throw new Error("Failed to load testimonials");
        const j = await res.json();
        const all = j.items || j || [];
        // filter isHome truthy (1, true, "1")
        const homeOnes = all.filter((t) => {
          const v = t.isHome;
          return v === 1 || v === true || String(v) === "1";
        });
        if (!mounted) return;
        setTestimonials(homeOnes);
      } catch (err) {
        console.error(err);
        if (mounted) setError("Could not load testimonials");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  function scrollByAmount(amount) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }

  function scrollNext() {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.8);
    scrollByAmount(amount);
  }
  function scrollPrev() {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.8) * -1;
    scrollByAmount(amount);
  }

  // per-card image - fallback company logo
  const logoSrc = "/atenlogo.png";

  // Resolve a usable image src for a testimonial
  const resolveImageSrc = (t) => {
    if (!t) return DEV_TEST_FALLBACK;

    // 1) server-supplied absolute URL (preferred)
    if (t.customer_image_url && /^https?:\/\//i.test(t.customer_image_url)) return t.customer_image_url;

    // 2) stored value could already be absolute
    if (t.customer_image && /^https?:\/\//i.test(t.customer_image)) return t.customer_image;

    // 3) try helper to build absolute/prefixed url (handles leading /uploads)
    try {
      const maybe = getImageUrl(t.customer_image);
      if (maybe && /^https?:\/\//i.test(maybe)) return maybe;
    } catch (e) {
      // ignore and try next
    }

    // 4) if it's a relative storage path (like "testimonials/..jpg" or "/uploads/.."),
    // try to make absolute using BACKEND_BASE
    if (t.customer_image) {
      try {
        let p = String(t.customer_image || "").trim();
        if (p.startsWith("/")) p = p.slice(1);
        if (BACKEND_BASE) return `${BACKEND_BASE.replace(/\/$/, "")}/${p}`;
      } catch (e) {
        // fallthrough to fallback
      }
    }

    // 5) fallback: dev file or company logo
    return DEV_TEST_FALLBACK || logoSrc;
  };

  return (
    <div className="home-page">
      <header className="home-hero">
        <div className="hero-inner">
          <h1 className="hero-title">Design. Build. Thrive.</h1>
          <p className="hero-sub">
            Integrated solutions across Interiors, Realty and Engineering —
            crafted for modern living and lasting value.
          </p>
        </div>
      </header>

      <section className="service-grid-section">
        <div className="service-grid">
          {homeTypes.map((h) => (
            <Link
              key={h.name}
              to={h.path}
              className="service-cards"
              style={{ backgroundImage: `url(${h.background})` }}
            >
              <div className="service-overlay" />
              <div className="service-content">
                <div className="service-title">{h.name}</div>
                <div className="service-desc">{h.description}</div>
                <div className="service-cta">Explore {h.name.toLowerCase()}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="about-section panel-card">
        <div className="about-inner">
          <img src="/atenlogo.png" className="about-media" alt="Aten logo" />
          <div className="about-content">
            <h2>About Aten</h2>
            <p>
              We bring together design, property expertise and engineering rigor to
              deliver spaces people love. From conceptual design to final handover,
              our integrated approach ensures aesthetics, performance and value.
            </p>
            <ul className="about-list">
              <li><strong>Design-led:</strong> Human-centred interiors that fit your lifestyle.</li>
              <li><strong>Market-smart:</strong> Realty solutions tailored to local markets.</li>
              <li><strong>Built to last:</strong> Engineering practices focused on durability.</li>
            </ul>
            <Link to="/about" className="btn-primary small">Learn more</Link>
          </div>
        </div>
      </section>

      <section className="testimonials-section panel-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>What our clients say</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button aria-label="Scroll left" className="testimonial-arrow" onClick={scrollPrev}>‹</button>
            <button aria-label="Scroll right" className="testimonial-arrow" onClick={scrollNext}>›</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 24 }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 24, color: "crimson" }}>{error}</div>
        ) : testimonials.length === 0 ? (
          <div style={{ padding: 24 }}>No testimonials yet.</div>
        ) : (
          <div className="testimonials-track-wrap">
            <div className="testimonials-track" ref={trackRef} role="list">
              {testimonials.map((t) => {
                // resolve image per above helper
                const img = resolveImageSrc(t) || logoSrc;
                const role = t.service_type || t.role || "Customer";
                return (
                  <figure className="testimonial-card" key={t.id || t._id} role="listitem">
                    <div className="testimonial-media">
                      <img
                        src={img}
                        alt={`${t.name || "Customer"} photo`}
                        onError={(e) => {
                          // try server-provided url fallback, then logoSrc, then dev fallback
                          if (e.currentTarget.src !== (t.customer_image_url || t.customer_image || DEV_TEST_FALLBACK || logoSrc)) {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = t.customer_image_url || t.customer_image || DEV_TEST_FALLBACK || logoSrc;
                          } else {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = logoSrc;
                          }
                        }}
                      />
                    </div>
                    <blockquote>{t.review || t.text}</blockquote>
                    <figcaption>
                      <strong>{t.name || "Anonymous"}</strong>
                      <span className="muted"> — {role}</span>
                      <div className="testimonial-rating">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < (t.rating || 0) ? "#a88441" : "none"} stroke="#a88441" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 .587l3.668 7.431L23.6 9.753l-5.8 5.654L19.335 24 12 19.897 4.665 24l1.535-8.593L.4 9.753l7.932-1.735z"/>
                          </svg>
                        ))}
                      </div>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
