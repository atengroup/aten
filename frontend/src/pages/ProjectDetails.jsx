import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import "../assets/pages/ProjectDetail.css";
import { getImageUrl } from "../lib/api";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

function safeParseJson(v, fallback = []) {
  if (v === undefined || v === null) return fallback;
  if (Array.isArray(v)) return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

// extract youtube id from url or id
function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = String(url).trim();
    const patterns = [
      /(?:youtube\.com\/.*(?:\?|&)v=)([a-zA-Z0-9_-]{6,})/, // v=VIDEO
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{6,})/,                 // youtu.be/VIDEO
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/,       // embed/VIDEO
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{6,})/            // /v/VIDEO
    ];
    for (const re of patterns) {
      const m = u.match(re);
      if (m && m[1]) return m[1];
    }
    // fallback: plain id
    if (/^[a-zA-Z0-9_-]{6,}$/.test(u)) return u;
  } catch (err) {}
  return null;
}
function makeYoutubeThumbUrl(id) {
  if (!id) return "";
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

export default function ProjectDetail() {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // for video preview modal
  const [videoPreviewId, setVideoPreviewId] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);

    const loadBySlug = async () => {
      try {
        const res = await fetch(
          `${BACKEND_BASE}/api/projects/${encodeURIComponent(slug)}`
        );
        if (res.ok) {
          const data = await res.json();
          const p = data.project || data;
          normalizeAndSet(p);
          return;
        }

        if ([400, 404, 500].includes(res.status)) {
          const listRes = await fetch(`${BACKEND_BASE}/api/projects`);
          if (!listRes.ok) throw new Error("List fetch failed");
          const listJson = await listRes.json();
          const items = listJson.items || [];
          const bySlug = items.find((it) => String(it.slug) === String(slug));
          if (bySlug) return normalizeAndSet(bySlug);

          const maybeId = Number(slug);
          if (!Number.isNaN(maybeId)) {
            const byId = items.find((it) => Number(it.id) === maybeId);
            if (byId) return normalizeAndSet(byId);
          }
          toast.error("Project not found");
          setProject(null);
        } else {
          const txt = await res.text().catch(() => "");
          throw new Error(`Fetch failed ${res.status} ${txt}`);
        }
      } catch (err) {
        console.error("Error loading project:", err);
        toast.error("Failed to load project");
        setProject(null);
      } finally {
        setLoading(false);
      }
    };

    const normalizeAndSet = (p) => {
      if (!p) {
        setProject(null);
        setLoading(false);
        return;
      }

      // normalize gallery, highlights, amenities, configurations, videos
      const gallery = safeParseJson(p.gallery, []);
      const highlights = safeParseJson(p.highlights, []);
      const amenities = safeParseJson(p.amenities, []);
      const configurations = safeParseJson(p.configurations, []);
      const price_info =
        typeof p.price_info === "string"
          ? (() => {
              try {
                return JSON.parse(p.price_info);
              } catch {
                return p.price_info || null;
              }
            })()
          : p.price_info || null;

      // videos may be stored as array of objects or array of ids/urls or JSON string
      const rawVideos = safeParseJson(p.videos || p.video || p.videos_json || [], []);
      const videos = Array.isArray(rawVideos)
        ? rawVideos
            .map((v) => {
              // if it's object with id/url/thumbnail, normalize
              if (v && typeof v === "object" && (v.id || v.url || v.thumbnail)) {
                const id = v.id || extractYouTubeId(v.url) || extractYouTubeId(v.thumbnail) || null;
                const url = v.url || (id ? `https://www.youtube.com/watch?v=${id}` : "");
                const thumbnail = v.thumbnail || (id ? makeYoutubeThumbUrl(id) : "");
                if (!id) return null;
                return { id, url, thumbnail };
              }
              // if it's a plain string (id or url), extract id
              if (typeof v === "string") {
                const id = extractYouTubeId(v);
                if (!id) return null;
                return { id, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: makeYoutubeThumbUrl(id) };
              }
              return null;
            })
            .filter(Boolean)
        : [];

      const normalized = {
        ...p,
        gallery,
        highlights,
        amenities,
        configurations,
        price_info,
        videos,
      };

      setProject(normalized);
      setLoading(false);
    };

    loadBySlug();
  }, [slug]);

  if (loading) return <div style={{ padding: 24 }}>Loading project…</div>;
  if (!project)
    return (
      <div style={{ padding: 24 }}>
        <div>Project not found.</div>
        <div className="back-btn-container">
          <Link to="/projects" className="back-btn">
            Back to Projects
          </Link>
        </div>
      </div>
    );

  const gallery = project.gallery || [];

  return (
    <div className="project-detail">
      {/* Hero Section */}
      <div className="hero">
        <div className="hero-media">
          <img
            src={getImageUrl(project.thumbnail || "/placeholder.jpg")}
            alt={project.title}
          />
        </div>
        <div className="hero-meta">
          <h1 className="project-title">{project.title}</h1>
          <div className="project-location">
            {project.location_area}
            {project.city ? `, ${project.city}` : ""}
          </div>
          {project.rera && (
            <div className="project-rera">RERA: {project.rera}</div>
          )}
          <div className="cta-row">
            {project.contact_phone && (
              <a href={`tel:${project.contact_phone}`} className="btn-call">
                Call
              </a>
            )}
            {project.contact_phone && (
              <a
                href={`https://wa.me/${(project.contact_phone || "").replace(
                  /\D/g,
                  ""
                )}`}
                className="btn-wa"
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            )}
            {project.brochure_url && (
              <a
                href={project.brochure_url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                Download Brochure
              </a>
            )}
          </div>
          
        </div>
        <div className="overview-why">
            <h3>Why Choose {project.title}</h3>
            <p
              dangerouslySetInnerHTML={{
                __html:
                  project.description ||
                  project.long_description ||
                  project.about ||
                  "No description available.",
              }}
            />
          </div>
      </div>

      {/* Stack layout: all sections one after another */}
      <div className="stacked-content">

        {/* Overview Section */}
        <section className="overview">
          <div className="overview-top">
            <h2>Project Overview</h2>
            <div className="overview-sub">
             
            </div>
          </div>

          <div className="overview-grid">
            <div className="overview-item">
              <div className="overview-label">Residential Property Type</div>
              <div className="overview-value">
                {project.property_type || project.type || "—"}
              </div>
            </div>
            <div className="overview-item">
              <div className="overview-label">Construction Status</div>
              <div className="overview-value">{project.status || "—"}</div>
            </div>
            <div className="overview-item">
              <div className="overview-label">Land Area</div>
              <div className="overview-value">
                {project.land_area || project.area || "—"}
              </div>
            </div>
            <div className="overview-item">
              <div className="overview-label">Handover</div>
              <div className="overview-value">
                {project.handover || project.possession || "—"}
              </div>
            </div>
            <div className="overview-item">
              <div className="overview-label">Blocks & Units</div>
              <div className="overview-value">
                {project.blocks ||
                  (project.units ? `— | ${project.units} Units` : "—")}
              </div>
            </div>
            <div className="overview-item">
              <div className="overview-label">Floors</div>
              <div className="overview-value">{project.floors || "—"}</div>
            </div>
            <div className="overview-item">
              <div className="overview-label">Site Address</div>
              <div className="overview-value">{project.address || "—"}</div>
            </div>
            <div className="overview-item">
              <div className="overview-label">RERA Number</div>
              <div className="overview-value">{project.rera || "—"}</div>
            </div>
          </div>


          {/* Videos under Overview (after Why Choose) */}
          {project.videos && project.videos.length > 0 && (
            <div className="overview-videos" style={{ marginTop: 18 }}>
              <h3>Video Walkthroughs</h3>
              <div className="overview-videos-grid">
                {project.videos.map((v) => {
                  const thumb = v.thumbnail || makeYoutubeThumbUrl(v.id || extractYouTubeId(v.url));
                  return (
                   <div
  key={v.id}
  className="overview-video-block"
  role="button"
  tabIndex={0}
  onClick={() => setVideoPreviewId(v.id)}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setVideoPreviewId(v.id);
    }
  }}
  title="Click to play video"
>
  <img
    className="overview-video-thumb"
    src={thumb}
    alt={`video-${v.id}`}
    loading="lazy"
    onError={(e) => {
      e.currentTarget.onerror = null;
      e.currentTarget.src = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
    }}
  />

  {/* Play overlay */}
  <div className="play-overlay-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="34" height="34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M8 5v14l11-7z" fill="currentColor" />
    </svg>
  </div>
</div>

                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Amenities (moved before Highlights) */}
        <section className="amenities-panel panel-card">
          <h3>Amenities</h3>
          {project.amenities && project.amenities.length > 0 ? (
            <div className="amenities-grid">
              {project.amenities.map((a, i) => (
                <div key={i} className="amenity-chip">{a}</div>
              ))}
            </div>
          ) : (
            <p className="placeholder">No amenities listed.</p>
          )}
        </section>

        {/* Highlights */}
        <section className="highlights-panel panel-card">
          <h3>Highlights</h3>
          {project.highlights && project.highlights.length > 0 ? (
            <ul className="highlights-list">
              {project.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : (
            <p className="placeholder">No highlights available.</p>
          )}
        </section>

        {/* Configurations */}
        <section className="configs-panel panel-card">
          <h3>Configurations</h3>
          {(project.configurations || []).length > 0 ? (
            <div className="config-table-wrapper">
              <table className="config-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Size (sqft)</th>
                    <th>Price Range</th>
                  </tr>
                </thead>
                <tbody>
                  {(project.configurations || []).map((c, i) => (
                    <tr key={i}>
                      <td>{c.type || "—"}</td>
                      <td>
                        {c.size_min && c.size_max
                          ? `${c.size_min} - ${c.size_max}`
                          : c.size_min || c.size_max || "—"}
                      </td>
                      <td>
                        {c.price_min && c.price_max
                          ? `${c.price_min} - ${c.price_max}`
                          : c.price_min || c.price_max || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-config">No configurations available.</p>
          )}
        </section>

        {/* Developer Details (Full Width Card) */}
        {project.developer_name && (
          <section className="developer-card panel-card">
            <h3>Developer Details</h3>
            <div className="developer-card-inner">
              {project.developer_logo && (
                <div className="developer-card-logo">
                  <img
                    src={getImageUrl(project.developer_logo)}
                    alt={project.developer_name}
                  />
                </div>
              )}

              <div className="developer-card-info">
                <h3 className="developer-card-title">{project.developer_name}</h3>
                <p className="developer-card-desc">
                  {project.developer_description || "Trusted real estate developer."}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <section className="gallery-section panel-card">
            <h3 className="section-title">Gallery</h3>
            <div className="gallery">
              {gallery.map((g, i) => (
                <img
                  key={i}
                  src={getImageUrl(g)}
                  alt={`${project.title}-${i}`}
                  onClick={() => setLightboxIndex(i)}
                  className="gallery-img"
                />
              ))}
            </div>
          </section>
        )}

        <div className="back-btn-container" style={{ marginBottom: 36 }}>
          <Link to="/projects" className="back-btn">
            Back to Projects
          </Link>
        </div>
      </div>

      {/* Lightbox for gallery images */}
      {lightboxIndex !== null && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="lightbox-close"
            onClick={() => setLightboxIndex(null)}
          >
            ✕
          </button>
          <img
            src={getImageUrl(gallery[lightboxIndex])}
            alt="Fullscreen"
            className="lightbox-image"
          />
          {gallery.length > 1 && (
            <>
              <button
                className="lightbox-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(
                    (lightboxIndex - 1 + gallery.length) % gallery.length
                  );
                }}
              >
                ‹
              </button>
              <button
                className="lightbox-next"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % gallery.length);
                }}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}

      {/* Video preview modal */}
      {videoPreviewId && (
        <div className="lightbox-overlay" onClick={() => setVideoPreviewId(null)}>
          <button className="lightbox-close" onClick={() => setVideoPreviewId(null)}>✕</button>
          <div style={{ width: "90%", maxWidth: 1000, aspectRatio: "16/9", background: "#000" }}>
            <iframe
              title="video-preview"
              src={`https://www.youtube.com/embed/${videoPreviewId}?autoplay=1`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
