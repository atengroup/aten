// Home.jsx (module-ified & theme-updated)
import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import styles from "../assets/pages/Home.module.css";
import { getImageUrl } from "../lib/api"; // <- use helper to prefix /uploads etc.

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

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

export default function Home() {
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

  const logoSrc = "/atenlogo.png";

  const resolveImageSrc = (t) => {
    if (!t) return DEV_TEST_FALLBACK;

    if (t.customer_image_url && /^https?:\/\//i.test(t.customer_image_url)) return t.customer_image_url;
    if (t.customer_image && /^https?:\/\//i.test(t.customer_image)) return t.customer_image;

    try {
      const maybe = getImageUrl(t.customer_image);
      if (maybe && /^https?:\/\//i.test(maybe)) return maybe;
    } catch (e) {}

    if (t.customer_image) {
      try {
        let p = String(t.customer_image || "").trim();
        if (p.startsWith("/")) p = p.slice(1);
        if (BACKEND_BASE) return `${BACKEND_BASE.replace(/\/$/, "")}/${p}`;
      } catch (e) {}
    }

    return DEV_TEST_FALLBACK || logoSrc;
  };

  return (
    <div className={styles.homePage}>
      <header className={styles.homeHero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Find it. Design it. Build it.</h1>
          <h2>Seamlessly with Aten Group.</h2><br />
        </div>
      </header>

      <section className={styles.serviceGridSection}>
        <div className={styles.serviceGrid}>
          {homeTypes.map((h) => (
            <Link
              key={h.name}
              to={h.path}
              className={styles.serviceCards}
              style={{ backgroundImage: `url(${h.background})` }}
            >
              <div className={styles.serviceOverlay} />
              <div className={styles.serviceContent}>
                <div className={styles.serviceTitle}>{h.name}</div>
                <div className={styles.serviceDesc}>{h.description}</div>
                <div className={styles.serviceCta}>Explore {h.name.toLowerCase()}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={`${styles.aboutSection} ${styles.panelCard}`}>
        <div className={styles.aboutInner}>
          <img src="/atenlogo.png" className={styles.aboutMedia} alt="Aten logo" />
          <div className={styles.aboutContent}>
            <h2>About Aten</h2>
            <p>
             Aten Group delivers integrated interior design, real estate broking, and engineering & construction consultancy services. We align design insight, property expertise, and engineering precision to provide efficient, reliable, and value-driven solutions.
            </p>
            <p>
           With a unified workflow—spanning property search, modern interior design, and structural planning & construction—we ensure seamless project execution and long-term performance.
            </p>
            <p>
             
Design-led: Practical, modern interior design tailored to your lifestyle.
Market-smart: Professional real estate advisory supported by transparent guidance.
Built to last: Durable, efficient engineering and construction practices focused on quality.
            </p>
          </div>
        </div>
      </section>

      <section className={`${styles.testimonialsSection} ${styles.panelCard}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>What our clients say</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button aria-label="Scroll left" className={styles.testimonialArrow} onClick={scrollPrev}>‹</button>
            <button aria-label="Scroll right" className={styles.testimonialArrow} onClick={scrollNext}>›</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 24 }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 24, color: "crimson" }}>{error}</div>
        ) : testimonials.length === 0 ? (
          <div style={{ padding: 24 }}>No testimonials yet.</div>
        ) : (
          <div className={styles.testimonialsTrackWrap}>
            <div className={styles.testimonialsTrack} ref={trackRef} role="list">
              {testimonials.map((t) => {
                const img = resolveImageSrc(t) || logoSrc;
                const role = t.service_type || t.role || "Customer";
                return (
                  <figure className={styles.testimonialCard} key={t.id || t._id} role="listitem">
                    <div className={styles.testimonialMedia}>
                      <img
                        src={img}
                        alt={`${t.name || "Customer"} photo`}
                        onError={(e) => {
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
                      <span className={styles.muted}> — {role}</span>
                      <div className={styles.testimonialRating}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < (t.rating || 0) ? "var(--accent)" : "none"} stroke="var(--accent)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
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
