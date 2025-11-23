// File: src/pages/InterioHome.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "../assets/pages/InterioHome.css";
import { getImageUrl } from "../lib/api";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

// developer-provided test image (local file) - using uploaded path from session
const DEV_TEST_FALLBACK = "/mnt/data/4752a5a0-b285-4dc9-b344-1b7bc18e4618.png";

const SERVICES = [
  {
    id: "full-home",
    title: "Full Home Furnishing",
    subtitle: "Complete interiors for every room",
    img: "./public/bedroom1.jpg",
    path: "/home",
  },
  {
    id: "kitchen",
    title: "Kitchen Makeover",
    subtitle: "Smart kitchens that cook up joy",
    img: "./public/kitchen1.jpg",
    path: "/kitchen",
  },
  {
    id: "bathroom",
    title: "Bathroom Renovation",
    subtitle: "Luxury & smart wetspaces",
    img: "./public/bathroom1.jpg",
    path: "/bathroom",
  },
  {
    id: "wardrobe",
    title: "Wardrobe",
    subtitle: "Elegant storage solutions",
    img: "./public/wardrobe.jpg",
    path: "/wardrobe",
  },
];

const TRUST_PERKS = [
  { id: 1, title: "Design Experts", desc: "In-house designers & architects", icon: "./public/businessman.png" },
  { id: 2, title: "End-to-end Delivery", desc: "From design to execution", icon: "./public/message.png" },
  { id: 3, title: "Quality Materials", desc: "Premium sourced materials", icon: "./public/quality.png" },
  { id: 4, title: "Transparent Pricing", desc: "No hidden costs", icon: "./public/price-tag.png" },
];

const INSPIRATIONS = [
  DEV_TEST_FALLBACK,
  DEV_TEST_FALLBACK,
  DEV_TEST_FALLBACK,
  DEV_TEST_FALLBACK,
  DEV_TEST_FALLBACK,
];

function isInterioItem(item = {}) {
  if (!item) return false;
  const check = (v) => {
    if (!v && v !== 0) return false;
    return String(v).toLowerCase().includes("interio") ||
      String(v).toLowerCase().includes("interior") ||
      String(v).toLowerCase().includes("interiors");
  };
  return (
    check(item.service_type) ||
    check(item.type) ||
    check(item.category) ||
    check(item.tags) ||
    check(item.slug) ||
    check(item.title) ||
    !!item.isInterio ||
    !!item.is_interio
  );
}

export default function InterioHome() {
  const navigate = useNavigate();


  // testimonials + projects (existing logic)
  const [testimonials, setTestimonials] = useState([]);
  const [tLoading, setTLoading] = useState(false);
  const [tError, setTError] = useState("");
  const testiRef = useRef(null);

  const [projects, setProjects] = useState([]);
  const [pLoading, setPLoading] = useState(false);
  const [pError, setPError] = useState("");
  const projRef = useRef(null);

  // hero images (you can replace with curated images later)
  const HERO_SLIDES = [
    {
      id: "hero-1",
      img: "./public/bedroom1.jpg",
      title: "Design your dream home",
      subtitle: "End-to-end full-home furnishing with curated interiors",
      ctas: [
        { type: "modal", label: "Get Started (Full Home)", action: "openFullHomeModal" },
        { type: "link", label: "See Projects", to: "/projects" },
      ],
    },
    {
      id: "hero-2",
      img: "./public/bedroom2.jpg",
      title: "Give your kitchen a fresh life",
      subtitle: "Smart layouts, durable finishes and smart storage",
      ctas: [
        { type: "navigate", label: "Explore Kitchens", to: "/kitchen" },
        { type: "link", label: "Kitchen Ideas", to: "/inspiration/kitchen" },
      ],
    },
    {
      id: "hero-3",
      img: "./public/commercial.jpg",
      title: "Commercial Interiors",
      subtitle: "Offices | Retail | Hospitality spaces designed to impress",
      ctas: [
        { type: "navigate", label: "Get Quote", to: "/custom" },
        { type: "link", label: "View Packages", to: "/packages" },
      ],
    },
  ];
  const heroRef = useRef(null);
  const handleHeroCta = (cta) => {
    if (!cta) return;
    if (cta.type === "modal" && cta.action === "openFullHomeModal") {
      openFullHomeModal();
      return;
    }
    if (cta.type === "navigate") {
      navigate(cta.to);
      return;
    }
    if (cta.type === "link") {
      // plain link navigation (no auth)
      navigate(cta.to);
      return;
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadTestis() {
      setTLoading(true);
      setTError("");
      try {
        const res = await fetch(`${BACKEND_BASE}/api/testimonials?limit=1000`);
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const payload = await res.json();
        const arr = Array.isArray(payload) ? payload : payload.items || payload || [];
        const interio = arr.filter((it) => {
          if (!it) return false;
          if (it.page === "interio") return true;
          if (it.service_type && String(it.service_type).toLowerCase().includes("interio")) return true;
          return isInterioItem(it);
        });
        if (!mounted) return;
        setTestimonials(interio);
      } catch (err) {
        console.error("testimonials load:", err);
        if (mounted) setTError("Could not load testimonials");
      } finally {
        if (mounted) setTLoading(false);
      }
    }
    loadTestis();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadProjects() {
      setPLoading(true);
      setPError("");
      try {
        const res = await fetch(`${BACKEND_BASE}/api/projects`);
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const payload = await res.json();
        const arr = Array.isArray(payload) ? payload : payload.items || payload || [];
        const normalized = arr.map((p) => {
          try {
            const gallery = p.gallery ? (Array.isArray(p.gallery) ? p.gallery : JSON.parse(p.gallery)) : [];
            return { ...p, gallery };
          } catch {
            return { ...p, gallery: [] };
          }
        });
        const interio = normalized.filter((p) => isInterioItem(p));
        if (!mounted) return;
        setProjects(interio);
      } catch (err) {
        console.error("projects load:", err);
        if (mounted) setPError("Could not load projects");
      } finally {
        if (mounted) setPLoading(false);
      }
    }
    loadProjects();
    return () => { mounted = false; };
  }, []);

  // helpers to build image srcs for existing content
  const resolveImageSrc = (obj, field = "customer_image") => {
    if (!obj) return DEV_TEST_FALLBACK;
    if (obj.customer_image_url && /^https?:\/\//i.test(obj.customer_image_url)) return obj.customer_image_url;
    const val = obj[field];
    if (val && /^https?:\/\//i.test(val)) return val;
    try {
      const maybe = getImageUrl(val);
      if (maybe && /^https?:\/\//i.test(maybe)) return maybe;
    } catch (e) {}
    if (val) {
      try {
        let p = String(val || "").trim();
        if (p.startsWith("/")) p = p.slice(1);
        if (BACKEND_BASE) return `${BACKEND_BASE.replace(/\/$/, "")}/${p}`;
      } catch (e) {}
    }
    return DEV_TEST_FALLBACK;
  };

  // simple horizontal scroll helpers
  const scrollBy = (ref, amount = 1) => {
    const el = ref.current;
    if (!el) return;
    const step = Math.round(el.clientWidth * 0.8) * amount;
    el.scrollBy({ left: step, behavior: "smooth" });
  };

  // --- Modal state for Full Home selection ---
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(""); // "1BHK" | "2BHK" | "3BHK" | "4BHK" | "4+BHK" | "studio"

  const openFullHomeModal = (e) => {
    e?.preventDefault?.();
    setSelectedRoom("");
    setShowRoomModal(true);
  };

  const handleModalContinue = () => {
    if (!selectedRoom) {
      toast.error("Please choose a room type to continue");
      return;
    }
    setShowRoomModal(false);
    // navigate to full-home with query param - use /home route and add encoded room
    navigate(`/home/${encodeURIComponent(selectedRoom)}`);
  };

  return (
    <div className="interio-landing-page">
      {/* HERO: full-bleed carousel */}
      <header className="hero-landing">
        <div className="hero-track" ref={heroRef}>
          {HERO_SLIDES.map((slide) => {
            const bg = getImageUrl(slide.img) || slide.img || DEV_TEST_FALLBACK;
            return (
              <div
                key={slide.id}
                className="hero-slide"
                style={{ backgroundImage: `url(${bg})` }}
                role="listitem"
              >
                <div className="hero-overlay">
                  <div className="hero-inners">
                    <h1 className="hero-title">{slide.title}</h1>
                    <p className="hero-subs">{slide.subtitle}</p>

                    <div className="hero-cta" style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
                      {slide.ctas && slide.ctas.map((cta, i) => {
                        if (cta.type === "link") {
                          return (
                            <Link key={i} to={cta.to} className="btn hero-ghost">{cta.label}</Link>
                          );
                        }
                        return (
                          <button
                            key={i}
                            className={`btn ${cta.type === "modal" ? "hero-btn" : "hero-ghost"}`}
                            onClick={() => handleHeroCta(cta)}
                            style={{ cursor: "pointer" }}
                          >
                            {cta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hero-controls">
          <button aria-label="prev" onClick={() => scrollBy(heroRef, -1)} className="ctrl">‹</button>
          <button aria-label="next" onClick={() => scrollBy(heroRef, 1)} className="ctrl">›</button>
        </div>
      </header>

      {/* SERVICES */}
      <section className="services-section panel">
        <div className="section-head">
          <h4>Our Services</h4>
          <p className="muted">Everything you need to make a house a home</p>
        </div>

        <div className="services-grid">
          {SERVICES.map((s) => (
            <div
              key={s.id}
              className="service-card"
              onClick={(e) => {
                // For full-home, open modal; for others navigate to their route via protected nav
                if (s.id === "full-home") return openFullHomeModal(e);
                navigate(s.path);
              }}
            >
              <div className="service-media" style={{ backgroundImage: `url(${s.img})` }} />
              <div className="service-body">
                <h5>{s.title}</h5>
                <p className="muted">{s.subtitle}</p>
                <div style={{ marginTop: 8 }}>
                  {s.id === "full-home" ? (
                    <button
                      className="btn-smalls"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        openFullHomeModal(ev);
                      }}
                    >
                      Select Rooms
                    </button>
                  ) : (
                    <button
                      className="btn-smalls"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        navigate(s.path);
                      }}
                    >
                      Explore
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHY TRUST US */}
      <section className="trust-section panel">
        <div className="section-head">
          <h4>Why Trust Us</h4>
          <p className="muted">We take care of design, quality and delivery</p>
        </div>

        <div className="trust-grid">
          {TRUST_PERKS.map((p) => (
            <div key={p.id} className="perk-card">
              <div className="perk-icon"><img className="icon" src={p.icon} alt={p.title} /></div>
              <div>
                <div className="perk-title">{p.title}</div>
                <div className="perk-desc muted">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* INSPIRATION IDEAS */}
      <section className="inspiration-section panel">
        <div className="section-head">
          <h4>Inspiration Ideas</h4>
          <p className="muted">Browse designs & real projects for inspiration</p>
        </div>

        <div className="inspiration-track" role="list">
          {INSPIRATIONS.map((img, i) => {
            const url = getImageUrl(img) || img;
            return (
              <div key={i} className="inspo-card">
                <img src={url} alt={`inspo-${i}`} loading="lazy" />
                <div className="inspo-caption">Modern • Cozy • Minimal</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Testimonials (re-using resolved images) */}
      <section className="panel testimonials-section">
        <div className="section-head">
          <h4>What our clients say</h4>
          <div className="controls">
            <button onClick={() => scrollBy(testiRef, -1)} className="ctrl">‹</button>
            <button onClick={() => scrollBy(testiRef, 1)} className="ctrl">›</button>
          </div>
        </div>

        {tLoading ? (
          <div className="panel-empty">Loading testimonials…</div>
        ) : tError ? (
          <div className="panel-empty error">{tError}</div>
        ) : testimonials.length === 0 ? (
          <div className="panel-empty">No testimonials yet.</div>
        ) : (
          <div className="track-wrap">
            <div className="track testimonials-track" ref={testiRef} role="list">
              {testimonials.map((t) => {
                const imgSrc = resolveImageSrc(t, "customer_image");
                return (
                  <figure className="testimonial-card" key={t.id || t._id}>
                    <div className="testimonial-img">
                      <img
                        src={imgSrc}
                        alt={t.name || "Customer"}
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEV_TEST_FALLBACK; }}
                        loading="lazy"
                      />
                    </div>
                    <blockquote>{t.review || t.text || t.message}</blockquote>
                    <figcaption>
                      <strong>{t.name || "Anonymous"}</strong>
                      <span className="muted"> — {t.service_type || t.role || "Customer"}</span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Projects showcase (keeps existing) */}
      <section className="panel projects-section">
        <div className="section-head">
          <h4>Previous Projects</h4>
          <div className="controls">
            <button onClick={() => scrollBy(projRef, -1)} className="ctrl">‹</button>
            <button onClick={() => scrollBy(projRef, 1)} className="ctrl">›</button>
          </div>
        </div>

        {pLoading ? (
          <div className="panel-empty">Loading projects…</div>
        ) : pError ? (
          <div className="panel-empty error">{pError}</div>
        ) : projects.length === 0 ? (
          <div className="panel-empty">No projects found.</div>
        ) : (
          <div className="track-wrap">
            <div className="track projects-track" ref={projRef} role="list">
              {projects.map((p) => {
                const rawImg = (p.gallery && p.gallery[0]) || p.cover_image || DEV_TEST_FALLBACK;
                let img = rawImg;
                try {
                  if (!/^https?:\/\//i.test(rawImg)) {
                    const maybe = getImageUrl(rawImg);
                    img = maybe && /^https?:\/\//i.test(maybe) ? maybe : (BACKEND_BASE ? `${BACKEND_BASE.replace(/\/$/, "")}/${String(rawImg).replace(/^\/+/, "")}` : rawImg);
                  }
                } catch (e) {
                  img = rawImg;
                }

                return (
                  <article className="project-card" key={p.id || p._id}>
                    <div className="project-thumb" style={{ backgroundImage: `url(${img})` }} />
                    <div className="project-info">
                      <h5>{p.title || p.name || "Untitled Project"}</h5>
                      <div className="meta">{p.city || p.location || "—"} • {p.size || p.area || "—"}</div>
                      <div className="theme">{p.theme || p.design_theme || p.style || "—"}</div>
                      <div className="project-actions">
                        <Link to={`/projects/${p.id || p.slug || ""}`} className="btn small">View</Link>
                        <button className="btn small" onClick={() => navigate(`/projects/${p.id || p.slug || ""}`)}>Enquire</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* --- Room selection modal (updated with more options) --- */}
      {showRoomModal && (
        <div className="modal-backdrop" onClick={() => setShowRoomModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Select rooms to design</h3>
            <p className="muted">Pick a package to proceed with Full Home furnishing</p>

            <div className="room-options">
              {[
                { key: "1BHK", title: "1BHK", desc: "Living + Kitchen + Bedroom" },
                { key: "2BHK", title: "2BHK", desc: "Living + Dining + 2 Bedrooms" },
                { key: "3BHK", title: "3BHK", desc: "Spacious layout + multiple rooms" },
                { key: "4BHK", title: "4BHK", desc: "Larger layouts with 4 bedrooms" },
                { key: "4+BHK", title: "4+BHK", desc: "Large homes and custom solutions" },
                { key: "studio", title: "Studio", desc: "Compact living with smart design" },
              ].map((opt) => (
                <label key={opt.key} className={`room-opt ${selectedRoom === opt.key ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="room"
                    value={opt.key}
                    checked={selectedRoom === opt.key}
                    onChange={() => setSelectedRoom(opt.key)}
                  />
                  <div className="room-label">
                    <strong>{opt.title}</strong>
                    <div className="muted">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowRoomModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleModalContinue}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
