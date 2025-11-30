// src/pages/InterioHome.jsx (module-ified & theme-aware)
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import styles from "../assets/pages/InterioHome.module.css";
import { getImageUrl } from "../lib/api";
import {
  HERO_SLIDES as STATIC_HERO,
  SERVICES as STATIC_SERVICES,
  TRUST_PERKS as STATIC_PERKS,
  INSPIRATIONS as STATIC_INSP,
  PROJECTS as STATIC_PROJECTS,
} from "../data/interioContent";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");
// Use the uploaded image from your session as the shared fallback URL:
const UPLOADED_FALLBACK = "/mnt/data/cd4227da-020a-4696-be50-0e519da8ac56.png";
const DEV_TEST_FALLBACK = UPLOADED_FALLBACK;

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
  const heroRef = useRef(null);
  const testiRef = useRef(null);
  const projRef = useRef(null);
const [fullscreenImage, setFullscreenImage] = useState(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTitle, setGalleryTitle] = useState("");
  const [galleryImages, setGalleryImages] = useState([]);
  // testimonials
  const [testimonials, setTestimonials] = useState([]);
  const [tLoading, setTLoading] = useState(false);
  const [tError, setTError] = useState("");
 
  function normalizeImageUrl(url) {
    if (!url) return "";
    if (!url.includes("drive.google.com")) return url;

    // support: .../file/d/FILE_ID/..., ?id=FILE_ID, uc?id=FILE_ID
    const match = url.match(
      /(?:file\/d\/|open\?id=|uc\?id=|thumbnail\?id=)([a-zA-Z0-9_-]+)/
    );
    if (match && match[1]) {
      const id = match[1];
      return `https://drive.google.com/uc?export=view&id=${id}`;
    }
    return url;
  }
   function openGallery(title, images = []) {
    setGalleryTitle(title);
    setGalleryImages(images.map(normalizeImageUrl));
    setGalleryOpen(true);
  }

  function closeGallery() {
    setGalleryOpen(false);
    setGalleryImages([]);
    setGalleryTitle("");
  }
  function openFullscreen(src) {
  setFullscreenImage(src);
}

function closeFullscreen() {
  setFullscreenImage(null);
}
  // static content
  const HERO_SLIDES = STATIC_HERO;
  const SERVICES = STATIC_SERVICES;
  const TRUST_PERKS = STATIC_PERKS;
  const INSPIRATIONS = STATIC_INSP;
  const PROJECTS = STATIC_PROJECTS;

  const scrollBy = (ref, amount = 1) => {
    const el = ref.current;
    if (!el) return;
    const step = Math.round(el.clientWidth * 0.8) * amount;
    el.scrollBy({ left: step, behavior: "smooth" });
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
          if (it.service_type && String(it.service_type).toLowerCase().includes("interio")) return false;
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

  const resolveImageSrc = (obj, field = "customer_image") => {
    if (!obj) return DEV_TEST_FALLBACK;
    if (obj.customer_image_url && /^https?:\/\//i.test(obj.customer_image_url)) return obj.customer_image_url;
    const val = obj[field];
    if (val && /^https?:\/\//i.test(val)) return val;
    try {
      const maybe = getImageUrl(val);
      if (maybe && /^https?:\/\//i.test(maybe)) return maybe;
      if (maybe) return maybe;
    } catch (e) {}
    return DEV_TEST_FALLBACK;
  };

  // Modal state for Full Home selection
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("");

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
    navigate(`/home/${encodeURIComponent(selectedRoom)}`);
  };

  return (
    <div className={styles.interioLandingPage}>
      {/* HERO */}
      <header className={styles.heroLanding}>
        <div className={styles.heroTrack} ref={heroRef}>
          {HERO_SLIDES.map((slide) => {
            const bg = getImageUrl(slide.img) || slide.img || DEV_TEST_FALLBACK;
            return (
              <div
                key={slide.id}
                className={styles.heroSlide}
                style={{ backgroundImage: `url(${bg})` }}
                role="listitem"
              >
                <div className={styles.heroOverlay}>
                  <div className={styles.heroInners}>
                    <h1 className={styles.heroTitle}>{slide.title}</h1>
                    <p className={styles.heroSubs}>{slide.subtitle}</p>

                    <div className={styles.heroCta} style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
                      {slide.ctas && slide.ctas.map((cta, i) => {
                        if (cta.type === "link") {
                          return <Link key={i} to={cta.to} className={`${styles.btn} ${styles.heroGhost}`}>{cta.label}</Link>;
                        }
                        return (
                          <button
                            key={i}
                            className={`${styles.btn} ${cta.type === "modal" ? styles.heroBtn : styles.heroGhost}`}
                            onClick={() => {
                              if (cta.type === "modal" && cta.action === "openFullHomeModal") openFullHomeModal();
                              else if (cta.type === "navigate") navigate(cta.to);
                              else if (cta.type === "link") navigate(cta.to);
                            }}
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

        <div className={styles.heroControls}>
          <button aria-label="prev" onClick={() => scrollBy(heroRef, -1)} className={styles.ctrl}>‹</button>
          <button aria-label="next" onClick={() => scrollBy(heroRef, 1)} className={styles.ctrl}>›</button>
        </div>
      </header>

      {/* SERVICES */}
      <section className={`${styles.servicesSection} ${styles.panel}`}>
        <div className={styles.sectionHead}>
          <h4>Our Services</h4>
          <p className={styles.muted}>Everything you need to make a house a home</p>
        </div>

        <div className={styles.servicesGrid}>
          {SERVICES.map((s) => (
            <div
              key={s.id}
              className={styles.serviceCard}
              onClick={(e) => {
                if (s.id === "full-home") return openFullHomeModal(e);
                navigate(s.path);
              }}
            >
              <div className={styles.serviceMedia} style={{ backgroundImage: `url(${getImageUrl(s.img) || s.img})`}} />
              <div className={styles.serviceBody}>
                <h5>{s.title}</h5>
                <p className={styles.muted}>{s.subtitle}</p>
                <div style={{ marginTop: 8 }}>
                  <button
                    className={styles.btnSmalls}
                    onClick={(ev) => { ev.stopPropagation(); s.id === "full-home" ? openFullHomeModal(ev) : navigate(s.path); }}
                  >
                    {s.id === "full-home" ? "Select Rooms" : "Explore"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <section className={`${styles.trustSection} ${styles.panel}`}>
        <div className={styles.sectionHead}>
          <h4>Why Trust Us</h4>
          <p className={styles.muted}>We take care of design, quality and delivery</p>
        </div>

        <div className={styles.trustGrid}>
          {TRUST_PERKS.map((p) => (
            <div key={p.id} className={styles.perkCard}>
              <div className={styles.perkIcon}>
                <img className={styles.icon} src={getImageUrl(p.icon) || p.icon} alt={p.title} />
              </div>
              <div>
                <div className={styles.perkTitle}>{p.title}</div>
                <div className={`${styles.perkDesc} ${styles.muted}`}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

{/* ---------- INSPIRATION SECTION: ONE THUMBNAIL -> MULTI IMAGES ---------- */}
<section className={`${styles.inspirationSection} ${styles.panel}`}>
  <div className={styles.sectionHead}>
    <h4>Inspiration</h4>
    <p className={styles.muted}>Some looks to kick-start your ideas</p>
  </div>

  <div className={styles.inspirationTrack}>
    {INSPIRATIONS.map((item, idx) => {
      const isObj = typeof item === "object" && item !== null;

      const title = isObj
        ? item.title || `Inspiration ${idx + 1}`
        : `Inspiration ${idx + 1}`;

      const images = isObj
        ? (item.images && item.images.length ? item.images : [item.cover]).filter(Boolean)
        : [item]; // legacy string case

      const thumbSrc = normalizeImageUrl(
        isObj
          ? item.cover || images[0] // prefer explicit cover
          : item
      );

      return (
        <button
          key={isObj ? item.id || idx : idx}
          type="button"
          className={styles.inspoCard}
          onClick={() => openGallery(title, images)}
        >
          <img
            src={thumbSrc}
            alt={title}
            loading="lazy"
          />
          <div className={styles.inspoCaption}>
            {title}
            {images.length > 1 && (
              <span className={styles.inspoCount}>
                • {images.length} photos
              </span>
            )}
          </div>
        </button>
      );
    })}
  </div>
</section>


      {/* TESTIMONIALS */}
      <section className={`${styles.panel} ${styles.testimonialsSection}`}>
        <div className={styles.sectionHeads}>
          <h4>What our clients say</h4>
          <div className={styles.controls}>
            <button onClick={() => scrollBy(testiRef, -1)} className={styles.ctrl}>‹</button>
            <button onClick={() => scrollBy(testiRef, 1)} className={styles.ctrl}>›</button>
          </div>
        </div>

        {tLoading ? (
          <div className={styles.panelEmpty}>Loading testimonials…</div>
        ) : tError ? (
          <div className={`${styles.panelEmpty} ${styles.error}`}>{tError}</div>
        ) : testimonials.length === 0 ? (
          <div className={styles.panelEmpty}>No testimonials yet.</div>
        ) : (
          <div className={styles.trackWrap}>
            <div className={`${styles.track} ${styles.testimonialsTrack}`} ref={testiRef} role="list">
              {testimonials.map((t) => {
                const imgSrc = resolveImageSrc(t, "customer_image");
                return (
                  <figure className={styles.testimonialCard} key={t.id || t._id}>
                    <div className={styles.testimonialImg}>
                      <img src={imgSrc} alt={t.name || "Customer"} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEV_TEST_FALLBACK; }} loading="lazy" />
                    </div>
                    <blockquote>{t.review || t.text || t.message}</blockquote>
                    <figcaption>
                      <strong>{t.name || "Anonymous"}</strong>
                      <span className={styles.muted}> — {t.service_type || t.role || "Customer"}</span>
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

      {/* PROJECTS */}
       <section className={`${styles.projectsSection} ${styles.panel}`}>
        <div className={styles.sectionHeads}>
          <div className={styles.sectionHead}>
            <h4>Previous Projects</h4>
            <p className={styles.muted}>A few spaces we have already styled</p>
          </div>
        </div>

        <div className={styles.trackWrap}>
          <div className={styles.projectsTrack}>
            {PROJECTS.map((p) => (
              <article key={p.id} className={styles.projectCard}>
                <div
                  className={styles.projectThumb}
                  style={{
                    backgroundImage: `url('${normalizeImageUrl(
                      p.cover_image
                    )}')`,
                  }}
                />
                <div className={styles.projectInfo}>
                  <h5>{p.title}</h5>
                  <div className={styles.meta}>
                    {p.city} • {p.size}
                  </div>
                  {p.theme && (
                    <span className={styles.theme}>{p.theme}</span>
                  )}

                  <div className={styles.projectActions}>
                    {/* NEW: open gallery of all photos for this project */}
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.heroBtn} ${styles.small}`}
                      onClick={() =>
                        openGallery(
                          p.title,
                          (p.gallery && p.gallery.length
                            ? p.gallery
                            : [p.cover_image]
                          )
                        )
                      }
                    >
                      View Photos
                    </button>

                    {/* keep whatever existing action you had (e.g. navigate) */}
                   
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
{/* ---------- NEW: GALLERY MODAL ---------- */}
      {galleryOpen && (
        <div className={styles.modalBackdrop} onClick={closeGallery}>
          <div
            className={`${styles.modal} ${styles.galleryModal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.galleryHeader}>
              <h3>{galleryTitle}</h3>
              <button
                type="button"
                className={styles.galleryClose}
                onClick={closeGallery}
              >
                ×
              </button>
            </div>

            <div
              className={`${styles.galleryGrid} ${
                galleryImages.length === 3 ? styles.galleryGridThree : ""
              }`}
            >
              {galleryImages.map((src, idx) => (
  <div
    key={idx}
    className={styles.galleryItem}
    onClick={() => openFullscreen(src)}
    style={{ cursor: "zoom-in" }}
  >
    <img
      src={src}
      alt={`${galleryTitle} ${idx + 1}`}
      loading="lazy"
    />
  </div>
))}
            </div>
          </div>
        </div>
      )}
 {/* ---------- FULLSCREEN IMAGE VIEWER ---------- */}
{fullscreenImage && (
  <div className={styles.fullscreenBackdrop} onClick={closeFullscreen}>
    <div
      className={styles.fullscreenWrapper}
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={fullscreenImage}
        alt="fullscreen view"
        className={styles.fullscreenImg}
      />
      <button
        className={styles.fullscreenClose}
        onClick={closeFullscreen}
        type="button"
      >
        ×
      </button>
    </div>
  </div>
)}

      {/* ROOM MODAL */}
      {showRoomModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowRoomModal(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Select rooms to design</h3>
            <p className={styles.muted}>Pick a package to proceed with Full Home furnishing</p>

            <div className={styles.roomOptions}>
              {[
                { key: "1BHK", title: "1BHK", desc: "Living + Kitchen + Bedroom" },
                { key: "2BHK", title: "2BHK", desc: "Living + Dining + 2 Bedrooms" },
                { key: "3BHK", title: "3BHK", desc: "Spacious layout + multiple rooms" },
                { key: "4BHK", title: "4BHK", desc: "Larger layouts with 4 bedrooms" },
                { key: "4+BHK", title: "4+BHK", desc: "Large homes and custom solutions" },
                { key: "studio", title: "Studio", desc: "Compact living with smart design" },
              ].map((opt) => (
                <label key={opt.key} className={`${styles.roomOpt} ${selectedRoom === opt.key ? styles.active : ""}`}>
                  <input type="radio" name="room" value={opt.key} checked={selectedRoom === opt.key} onChange={() => setSelectedRoom(opt.key)} />
                  <div className={styles.roomLabel}>
                    <strong>{opt.title}</strong>
                    <div className={styles.muted}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button className={`${styles.btn} ${styles.ghost}`} onClick={() => setShowRoomModal(false)}>Cancel</button>
              <button className={`${styles.btn} ${styles.primary}`} onClick={handleModalContinue}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
