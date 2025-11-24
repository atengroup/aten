// src/pages/ProjectDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import styles from "../assets/pages/ProjectDetail.module.css";
import { getImageUrl } from "../lib/api";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

function safeParseJson(v, fallback = []) {
  if (v === undefined || v === null) return fallback;
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v); }
  catch { return fallback; }
}

function extractYouTubeId(url) {
  if (!url) return null;
  const u = String(url).trim();
  const patterns = [
    /(?:youtube\.com\/.*(?:\?|&)v=)([a-zA-Z0-9_-]{6,})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{6,})/
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (m && m[1]) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{6,}$/.test(u)) return u;
  return null;
}

const makeYoutubeThumbUrl = (id) =>
  id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : "";

export default function ProjectDetail() {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [videoPreviewId, setVideoPreviewId] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);

    async function load() {
      try {
        const res = await fetch(`${BACKEND_BASE}/api/projects/${slug}`);
        if (res.ok) {
          const data = await res.json();
          normalize(data.project || data);
          return;
        }

        const list = await fetch(`${BACKEND_BASE}/api/projects`);
        const json = await list.json();
        const items = json.items || [];
        const fallback = items.find((p) => String(p.slug) === String(slug));

        if (fallback) normalize(fallback);
        else toast.error("Project not found");
      } catch (err) {
        console.error(err);
        toast.error("Failed to load project");
      } finally {
        setLoading(false);
      }
    }

    function normalize(p) {
      const gallery = safeParseJson(p.gallery, []);
      const highlights = safeParseJson(p.highlights, []);
      const amenities = safeParseJson(p.amenities, []);
      const configurations = safeParseJson(p.configurations, []);
      const rawVideos = safeParseJson(p.videos || p.video || [], []);

      const videos = rawVideos
        .map((v) => {
          if (typeof v === "string") {
            const id = extractYouTubeId(v);
            return id
              ? { id, url: `https://youtube.com/watch?v=${id}`, thumbnail: makeYoutubeThumbUrl(id) }
              : null;
          }
          if (typeof v === "object") {
            const id = v.id || extractYouTubeId(v.url);
            return id
              ? { id, url: v.url, thumbnail: v.thumbnail || makeYoutubeThumbUrl(id) }
              : null;
          }
          return null;
        })
        .filter(Boolean);

      setProject({ ...p, gallery, highlights, amenities, configurations, videos });
    }

    load();
  }, [slug]);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!project)
    return (
      <div style={{ padding: 24 }}>
        <div>Project not found.</div>
        <Link to="/projects">Back</Link>
      </div>
    );

  const gallery = project.gallery || [];

  return (
    <div className={styles.projectDetail}>
      
      {/* ---------------- Hero ---------------- */}
      <div className={styles.hero}>
        <div className={styles.heroMedia}>
          <img src={getImageUrl(project.thumbnail || "/placeholder.jpg")} alt={project.title} />
        </div>

        <div className={styles.heroMeta}>
          <h1 className={styles.projectTitle}>{project.title}</h1>
          <div className={styles.projectLocation}>
            {project.location_area}{project.city ? `, ${project.city}` : ""}
          </div>
          {project.rera && <div className={styles.projectRera}>RERA: {project.rera}</div>}

          <div className={styles.ctaRow}>
            {project.contact_phone && (
              <>
                <a href={`tel:${project.contact_phone}`} className={styles.btnCall}>Call</a>
                <a
                  href={`https://wa.me/${project.contact_phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.btnWa}
                >
                  WhatsApp
                </a>
              </>
            )}
            {project.brochure_url && (
              <a href={project.brochure_url} target="_blank" rel="noreferrer" className={styles.btnSecondary}>
                Download Brochure
              </a>
            )}
          </div>
        </div>

        <div className={styles.overviewWhy}>
          <h3>Why Choose {project.title}</h3>
          <div dangerouslySetInnerHTML={{ __html: project.description || "" }} />
        </div>
      </div>

      {/* ---------------- Overview ---------------- */}
      <div className={styles.overview}>
        <h2>Overview</h2>

        <div className={styles.overviewGrid}>
          <div className={styles.overviewItem}>
            <div className={styles.overviewLabel}>Property Type</div>
            <div className={styles.overviewValue}>{project.property_type}</div>
          </div>

          <div className={styles.overviewItem}>
            <div className={styles.overviewLabel}>Address</div>
            <div className={styles.overviewValue}>{project.address?project.address:"----"}</div>
          </div>

          <div className={styles.overviewItem}>
            <div className={styles.overviewLabel}>Construction Status</div>
            <div className={styles.overviewValue}>{project.status ? project.status :"----"}</div>
          </div>

          <div className={styles.overviewItem}>
            <div className={styles.overviewLabel}>Land Area</div>
            <div className={styles.overviewValue}>{project.land_area ? project.land_area :"----"}</div>
          </div>

          <div className={styles.overviewItem}>
            <div className={styles.overviewLabel}>Floors</div>
            <div className={styles.overviewValue}>{project.floors ? project.floors: "----"}</div>
          </div>

          <div className={styles.overviewItem}>
            <div className={styles.overviewLabel}>Units</div>
            <div className={styles.overviewValue}>{project.units?project.units:"----"}</div>
          </div>

          <div className={styles.overviewItem}>
            <div className={styles.overviewLabel}>Blocks</div>
            <div className={styles.overviewValue}>{project.blocks?project.blocks:"----"}</div>
          </div>

          <div className={styles.overviewItem}>
            <div className={styles.overviewLabel}>Handover</div>
            <div className={styles.overviewValue}>{project.handover?project.handover:"----"}</div>
          </div>
        </div>
        

        {/* ----- Videos ------- */}
        {project.videos?.length > 0 && (
          <div className={styles.overviewVideos}>
            <h3>Video Walkthroughs</h3>

            <div className={styles.overviewVideosGrid}>
              {project.videos.map((v) => (
                <div
                  key={v.id}
                  className={styles.videoBlock}
                  onClick={() => setVideoPreviewId(v.id)}
                >
                  <img
                    src={v.thumbnail}
                    className={styles.videoThumb}
                    alt=""
                  />
                  <div className={styles.playIcon}>
                    <div className={styles.playCircle}>
                      ▶
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---------------- Amenities ---------------- */}
      <section className={`${styles.panelCard} ${styles.amenitiesPanel}`}>
        <h3>Amenities</h3>
        <div className={styles.amenitiesGrid}>
          {(project.amenities || []).map((a, i) => (
            <div key={i} className={styles.amenityChip}>{a}</div>
          ))}
        </div>
      </section>

      {/* ---------------- Highlights ---------------- */}
      <section className={`${styles.panelCard}`}>
        <h3>Highlights</h3>
        <ul className={styles.highlightsList}>
          {(project.highlights || []).map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </section>

      {/* ---------------- Configurations ---------------- */}
      <section className={`${styles.panelCard}`}>
        <h3>Configurations</h3>
        <div className={styles.configTableWrapper}>
          <table className={styles.configTable}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Size</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {(project.configurations || []).map((c, i) => (
                <tr key={i}>
                  <td>{c.type}</td>
                  <td>{c.size_min} - {c.size_max}</td>
                  <td>{c.price_min} - {c.price_max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------- Gallery ---------------- */}
      {gallery.length > 0 && (
        <section className={`${styles.panelCard} ${styles.gallerySection}`}>
          <h3>Gallery</h3>
          <div className={styles.gallery}>
            {gallery.map((g, i) => (
              <img
                key={i}
                src={getImageUrl(g)}
                className={styles.galleryImg}
                onClick={() => setLightboxIndex(i)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Lightbox ---------------- */}
      {lightboxIndex !== null && (
        <div className={styles.lightbox} onClick={() => setLightboxIndex(null)}>
          <button className={styles.lightboxClose}>✕</button>
          <img
            src={getImageUrl(gallery[lightboxIndex])}
            className={styles.lightboxImage}
          />
        </div>
      )}

      {/* ---------------- Video Lightbox ---------------- */}
      {videoPreviewId && (
        <div className={styles.lightbox} onClick={() => setVideoPreviewId(null)}>
          <button className={styles.lightboxClose}>✕</button>

          <iframe
            style={{ width: "90%", maxWidth: "900px", height: "60vh" }}
            src={`https://www.youtube.com/embed/${videoPreviewId}?autoplay=1`}
            allow="autoplay; fullscreen"
          />
        </div>
      )}

      {/* Back Button */}
      <div style={{ marginTop: 20 }}>
        <Link to="/projects">← Back to Projects</Link>
      </div>
    </div>
  );
}
