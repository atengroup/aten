// src/pages/admin/ProjectForm.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import "../../assets/pages/admin/ProjectForm.css";
import { getImageUrl } from "../../lib/api";
import Dropdown from "../../components/Dropdown";
import { auth } from "../../firebaseConfig"; // <- used for token fallback

const emptyConfig = () => ({
  type: "3 BHK",
  size_min: "",
  size_max: "",
  price_min: "",
  price_max: "",
});

function safeParseJson(v, fallback = []) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined || v === "") return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

// Backend base: use VITE var or localhost in dev, else same-origin
const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");


/* ----------------- auth helpers (safe polling + header builder) ----------------- */
async function getAuthToken({ timeoutMs = 3000, intervalMs = 150 } = {}) {
  const start = Date.now();

  const readStored = () => {
    try {
      const s = sessionStorage.getItem("auth_token");
      if (s && s !== "null" && s !== "") return s;
    } catch {}
    try {
      const l = localStorage.getItem("auth_token");
      if (l && l !== "null" && l !== "") return l;
    } catch {}
    return null;
  };

  while (Date.now() - start < timeoutMs) {
    const stored = readStored();
    if (stored) return stored;

    try {
      if (auth && auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken(false);
        if (idToken) {
          try { localStorage.setItem("auth_token", idToken); } catch {}
          try { sessionStorage.setItem("auth_token", idToken); } catch {}
          return idToken;
        }
      }
    } catch {}
    await new Promise((res) => setTimeout(res, intervalMs));
  }

  // final forced refresh attempt
  try {
    if (auth && auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken(true);
      if (idToken) {
        try { localStorage.setItem("auth_token", idToken); } catch {}
        try { sessionStorage.setItem("auth_token", idToken); } catch {}
        return idToken;
      }
    }
  } catch {}
  return null;
}

async function makeHeaders({ forJson = false } = {}) {
  const token = await getAuthToken();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (forJson) headers["Content-Type"] = "application/json";
  return headers;
}
/* ------------------------------------------------------------------------------- */

/* ----------------- YouTube helpers ----------------- */
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
/* --------------------------------------------------- */

export default function ProjectForm() {
  const { id } = useParams(); // "new" or numeric/id or slug
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const developerLogoModeRef = useRef(false);
  const devLogoFileRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Developers dropdown
  const [developersList, setDevelopersList] = useState([]); // { name, logo, description }
  const [developerSelected, setDeveloperSelected] = useState(""); // name or "custom"

  // form state
  const [form, setForm] = useState({
    title: "",
    slug: "",
    location_area: "",
    city: "",
    address: "",
    rera: "",
    status: "Active",
    property_type: "Residential",
    configurations: [emptyConfig()],
    highlights: [],
    amenities: [],
    gallery: [],
    thumbnail: "",
    brochure_url: "",
    contact_phone: "",
    contact_email: "",
    price_info: null,
    blocks: "",
    units: "",
    floors: "",
    land_area: "",
    description: "",
    developer_name: "",
    developer_description: "",
    developer_logo: "",
    videos: [], // new: array of { id, url, thumbnail }
  });

  const [amenityText, setAmenityText] = useState("");
  const [highlightText, setHighlightText] = useState("");

  // uploads modal state
  const [showUploadsModal, setShowUploadsModal] = useState(false);
  const [uploadsList, setUploadsList] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [selectedUploads, setSelectedUploads] = useState(new Set());

  // YouTube inputs / preview
  const [videoUrlText, setVideoUrlText] = useState("");
  const [videoPreviewModal, setVideoPreviewModal] = useState(null); // { id, url, thumbnail } or null

  // ---- load developers list (dedupe) ----
  async function fetchDevelopersList() {
  try {
    const headers = await makeHeaders();
    const res = await fetch(`${BACKEND_BASE}/api/projects`, { headers });
    if (!res.ok) {
      throw new Error(`projects endpoint failed: ${res.status}`);
    }

    const body = await res.json().catch(() => null);
    // support both { items: [...] } and plain array responses
    const rawItems = Array.isArray(body) ? body : (body && Array.isArray(body.items) ? body.items : []);

    const map = new Map();
    for (const it of rawItems) {
      // robust extraction of developer name/logo/description from different shapes
      const name =
        (it && (
          it.developer_name ||
          it.developer ||
          (it.developer && it.developer.name) ||
          ""
        ) || ""
        ).toString().trim();

      if (!name) continue;

      const logo =
        (it && (
          it.developer_logo ||
          it.logo ||
          (it.developer && it.developer.logo) ||
          ""
        ) || "").toString().trim();

      const description =
        (it && (
          it.developer_description ||
          it.developer_description ||
          (it.developer && it.developer.description) ||
          ""
        ) || "").toString().trim();

      if (!map.has(name)) {
        map.set(name, { name, logo, description });
      }
    }

    const uniq = Array.from(map.values()).map(d => ({
      name: d.name,
      logo: d.logo || "",
      description: d.description || ""
    }));

    setDevelopersList(uniq);
  } catch (err) {
    console.warn("Could not load developers list:", err);
    setDevelopersList([]);
  }
}


  useEffect(() => {
    fetchDevelopersList();
  }, []);

  // ---- load existing project (edit) ----
  useEffect(() => {
    if (!id || id === "new") return;
    (async () => {
      setLoading(true);
      try {
        const headers = await makeHeaders();
        let res = await fetch(`${BACKEND_BASE}/api/projects/${encodeURIComponent(id)}`, { headers });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const p = data?.project || data;
          if (p) fillFormFromProject(p);
          setLoading(false);
          return;
        }

        // fallback: list and find
        const listRes = await fetch(`${BACKEND_BASE}/api/projects`, { headers });
        if (!listRes.ok) {
          toast.error("Failed to load project list");
          setLoading(false);
          return;
        }
        const listJson = await listRes.json();
        const items = listJson.items || [];
        const byId = items.find((it) => String(it.id) === String(id));
        const bySlug = items.find((it) => String(it.slug) === String(id));
        const found = byId || bySlug;
        if (found) fillFormFromProject(found);
        else toast.error("Project not found");
      } catch (err) {
        console.error("Load project error", err);
        toast.error("Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function fillFormFromProject(p) {
    const gallery = safeParseJson(p.gallery, []);
    const highlights = safeParseJson(p.highlights, []);
    const amenities = safeParseJson(p.amenities, []);
    const configs = safeParseJson(p.configurations, p.configurations && p.configurations.length ? p.configurations : [emptyConfig()]);
    const price_info = p.price_info && typeof p.price_info === "string"
      ? (() => { try { return JSON.parse(p.price_info); } catch { return p.price_info; } })()
      : p.price_info || null;
    const videos = safeParseJson(p.videos || p.video || p.videos_json || [], []);

    setForm((prev) => ({
      ...prev,
      title: p.title || "",
      slug: p.slug || "",
      location_area: p.location_area || "",
      city: p.city || "",
      address: p.address || "",
      rera: p.rera || "",
      status: p.status || "Active",
      property_type: p.property_type || "Residential",
      configurations: Array.isArray(configs) ? configs : [emptyConfig()],
      highlights: Array.isArray(highlights) ? highlights : [],
      amenities: Array.isArray(amenities) ? amenities : [],
      gallery: Array.isArray(gallery) ? gallery : [],
      thumbnail: p.thumbnail || (Array.isArray(gallery) && gallery.length ? gallery[0] : ""),
      brochure_url: p.brochure_url || "",
      contact_phone: p.contact_phone || "",
      contact_email: p.contact_email || "",
      price_info,
      blocks: p.blocks || "",
      units: p.units || "",
      floors: p.floors || "",
      land_area: p.land_area || "",
      description: p.description || "",
      developer_name: p.developer_name || "",
      developer_description: p.developer_description || "",
      developer_logo: p.developer_logo || "",
      videos: Array.isArray(videos) ? videos : [],
    }));
  }

  // ---- helpers to update state ----
  const setField = (field, value) => setForm((s) => ({ ...s, [field]: value }));
  const setConfigAt = (idx, obj) =>
    setForm((s) => ({ ...s, configurations: s.configurations.map((c, i) => (i === idx ? { ...c, ...obj } : c)) }));

  const addConfiguration = () => setForm((s) => ({ ...s, configurations: [...s.configurations, emptyConfig()] }));
  const removeConfiguration = (idx) => setForm((s) => ({ ...s, configurations: s.configurations.filter((_, i) => i !== idx) }));

  const addAmenity = () => {
    const txt = amenityText.trim();
    if (!txt) {
      toast.error("Amenity is empty");
      return;
    }
    setForm((s) => ({ ...s, amenities: [...s.amenities, txt] }));
    setAmenityText("");
    toast.success("Amenity added");
  };
  const removeAmenity = (i) => setForm((s) => ({ ...s, amenities: s.amenities.filter((_, idx) => idx !== i) }));

  const addHighlight = () => {
    const txt = highlightText.trim();
    if (!txt) {
      toast.error("Highlight is empty");
      return;
    }
    setForm((s) => ({ ...s, highlights: [...s.highlights, txt] }));
    setHighlightText("");
    toast.success("Highlight added");
  };
  const removeHighlight = (i) => setForm((s) => ({ ...s, highlights: s.highlights.filter((_, idx) => idx !== i) }));

  // ---- image upload (now accepts options) ----
  async function uploadFiles(files, options = {}) {
    if (!files || files.length === 0) return [];
    setUploading(true);
    const uploadedUrls = [];
    const toastId = options.silent ? null : toast.loading("Uploading images...");
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const headers = await makeHeaders();
        if (headers["Content-Type"]) delete headers["Content-Type"];

        const res = await fetch(`${BACKEND_BASE}/api/uploads`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => String(res.status));
          console.error("Upload failed", res.status, txt);
          if (!options.silent) toast.error(`Upload failed: ${res.status}`, { id: toastId });
          continue;
        }
        const j = await res.json().catch(() => null);
        if (j && j.url) uploadedUrls.push(j.url);
        else if (j && j.path) uploadedUrls.push(j.path);
        else if (j && j.filename) uploadedUrls.push(`/uploads/${j.filename}`);
        else if (typeof j === "string") uploadedUrls.push(j);
      }

      if (uploadedUrls.length) {
        setForm((s) => {
          const newGallery = [...s.gallery, ...uploadedUrls];
          const thumbnail = s.thumbnail || newGallery[0] || "";
          return { ...s, gallery: newGallery, thumbnail };
        });
        if (!options.silent) toast.success(`Uploaded ${uploadedUrls.length} image(s)`, { id: toastId });
      } else {
        if (toastId) toast.dismiss(toastId);
      }
      return uploadedUrls;
    } catch (err) {
      console.error("Upload error", err);
      if (!options.silent) toast.error("Image upload failed");
      if (toastId) toast.dismiss(toastId);
      return [];
    } finally {
      setUploading(false);
    }
  }

  const onFileChange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    uploadFiles(files);
    e.target.value = null;
  };

  const removeGalleryItem = (i) => {
    setForm((s) => {
      const newGallery = s.gallery.filter((_, idx) => idx !== i);
      const newThumbnail = s.thumbnail === s.gallery[i] ? newGallery[0] || "" : s.thumbnail;
      return { ...s, gallery: newGallery, thumbnail: newThumbnail };
    });
    toast.success("Image removed");
  };

  const setThumbnail = (url) => {
    setForm((s) => ({ ...s, thumbnail: url }));
    toast.success("Thumbnail selected");
  };

  // ---- fetch existing uploads list (uses auth) ----
  async function fetchUploadsList() {
  setUploadsLoading(true);
  setUploadsList([]);
  setSelectedUploads(new Set());
  try {
    const headers = await makeHeaders();
    const res = await fetch(`${BACKEND_BASE}/api/uploads`, { headers });

    if (!res.ok) {
      throw new Error(`Uploads listing failed: ${res.status}`);
    }

    const body = await res.json().catch(() => null);
    let arr = [];

    if (Array.isArray(body)) {
      // body is expected to be array of { path, name, signedUrl, ... }
      arr = body
        .map((item) => {
          if (!item) return null;
          // prefer signedUrl (private bucket)
          if (item.signedUrl && typeof item.signedUrl === "string") return item.signedUrl;
          if (item.publicUrl && typeof item.publicUrl === "string") return item.publicUrl;
          // fallback: if backend returned a plain URL string
          if (typeof item === "string" && item.startsWith("http")) return item;
          // fallback: use path (may be /uploads/xxx or storage path) — let getImageUrl handle it
          if (item.path) return item.path;
          if (item.url) return item.url;
          if (item.filename) return `/uploads/${item.filename}`;
          return null;
        })
        .filter(Boolean);
    } else {
      throw new Error("Unexpected uploads response shape");
    }

    // DEBUG: log exact list returned
    console.debug("uploadsList resolved to:", arr);
    setUploadsList(arr);
  } catch (err) {
    console.error("Failed to fetch uploads list:", err);
    toast.error("Failed to load uploads list. Check backend endpoint /api/uploads");
  } finally {
    setUploadsLoading(false);
  }
}


  const toggleUploadSelect = (url) => {
    setSelectedUploads((prev) => {
      const s = new Set(prev);
      if (s.has(url)) s.delete(url);
      else s.add(url);
      return s;
    });
  };

  const addSelectedUploadsToGallery = () => {
    const picked = Array.from(selectedUploads);
    if (picked.length === 0) {
      toast.error("No images selected");
      return;
    }
    setForm((s) => {
      const newGallery = [...s.gallery, ...picked];
      const thumbnail = s.thumbnail || newGallery[0] || "";
      return { ...s, gallery: newGallery, thumbnail };
    });
    toast.success(`Added ${picked.length} image(s) to gallery`);
    setShowUploadsModal(false);
  };

  // ---- YouTube video helpers ----
  const addVideo = () => {
    const raw = (videoUrlText || "").trim();
    if (!raw) {
      toast.error("Paste YouTube link first");
      return;
    }
    const vid = extractYouTubeId(raw);
    if (!vid) {
      toast.error("Not a valid YouTube URL / id");
      return;
    }

    setForm((s) => {
      const exists = (s.videos || []).some((v) => v.id === vid);
      if (exists) {
        toast.error("Video already added");
        return s;
      }
      const thumbnail = makeYoutubeThumbUrl(vid);
      const obj = { id: vid, url: `https://www.youtube.com/watch?v=${vid}`, thumbnail };
      const newVideos = [...(s.videos || []), obj];
      toast.success("Video added");
      return { ...s, videos: newVideos };
    });
    setVideoUrlText("");
  };

  const removeVideo = (idx) => {
    setForm((s) => {
      const newArr = (s.videos || []).filter((_, i) => i !== idx);
      return { ...s, videos: newArr };
    });
    toast.success("Video removed");
  };

  const openVideoPreview = (video) => {
    setVideoPreviewModal(video);
  };

  const closeVideoPreview = () => setVideoPreviewModal(null);

  // ---- submit ----
  const handleSubmit = async (e) => {
  e.preventDefault();
  if (!form.title || !form.city) {
    toast.error("Please fill Title and City (required).");
    return;
  }
  setLoading(true);
  const tid = toast.loading("Saving project...");
  try {
    // Serialize complex fields to JSON strings (server expects text)
    const payload = {
      ...form,
      gallery: JSON.stringify(form.gallery || []),
      highlights: JSON.stringify(form.highlights || []),
      amenities: JSON.stringify(form.amenities || []),
      configurations: JSON.stringify(form.configurations || []),
      videos: JSON.stringify(form.videos || []),
      price_info: form.price_info ? JSON.stringify(form.price_info) : null,
    };

    const method = id && id !== "new" ? "PUT" : "POST";
    const url = id && id !== "new"
      ? `${BACKEND_BASE}/api/projects/${id}`
      : `${BACKEND_BASE}/api/projects`;

    const headers = await makeHeaders({ forJson: true });

    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await res.json().catch(() => ({}));
      toast.success("Project saved", { id: tid });
      navigate("/admin/projects");
    } else {
      const err = await res.json().catch(() => ({}));
      console.error("Save error", err);
      const message = err.error || `Server responded ${res.status}`;
      toast.error("Save failed: " + message, { id: tid });
    }
  } catch (err) {
    console.error("Save error", err);
    toast.error("Save failed: exception", { id: tid });
  } finally {
    setLoading(false);
  }
};


  // ---------- UI ----------
  return (
    <div className="project-form-shell">
      <form className="project-form" onSubmit={handleSubmit}>
        <h2>{id && id !== "new" ? "Edit Project" : "Add Project"}</h2>

        <div className="instructions">
          <h3>How to fill this form (quick guide)</h3>
          <ul>
            <li><strong>Title</strong>: Name of the project (e.g. "DTC Skyler").</li>
            <li><strong>Slug</strong>: URL friendly id (auto generated from Title if left empty).</li>
            <li><strong>City / Location area</strong>: City and neighbourhood for search and listing cards.</li>
            <li><strong>Address</strong>: Short address or landmark for displays.</li>
            <li><strong>RERA</strong>: RERA number (if applicable).</li>
            <li><strong>Configurations</strong>: Add unit types with sizes and price ranges.</li>
            <li><strong>Amenities</strong>: Add features (Gym, Pool) one at a time.</li>
            <li><strong>Highlights</strong>: Short selling bullets.</li>
            <li><strong>Gallery</strong>: Upload images (jpg/png). After upload you can choose a thumbnail image for listing cards.</li>
            <li><strong>Videos</strong>: Add YouTube links for walkthroughs/promos — thumbnails will display and you can preview inline.</li>
            <li><strong>Metadata</strong>: Blocks, Units, Floors (used on detail page).</li>
            <li><strong>Thumbnail</strong>: The selected thumbnail is sent in the payload as <code>thumbnail</code>.</li>
          </ul>
        </div>

        <section className="grid-2">
          <label>
            Title *
            <input value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="Project title" required />
          </label>

          <label>
            Slug (optional)
            <input value={form.slug} onChange={(e) => setField("slug", e.target.value)} placeholder="auto-generated-from-title" />
          </label>

          <label>
            City *
            <input value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="e.g. Kolkata" required />
          </label>

          <label>
            Location area
            <input value={form.location_area} onChange={(e) => setField("location_area", e.target.value)} placeholder="Joka / Salt Lake" />
          </label>

          <label className="full">
            Address
            <textarea value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Full/short address" />
          </label>
          <label className="full">
            Description
            <textarea value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Full/short description" />
          </label>

          <label>
            RERA / Reg. No.
            <input value={form.rera} onChange={(e) => setField("rera", e.target.value)} placeholder="WBRERA/..." />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
              <option>Active</option>
              <option>Under Construction</option>
              <option>Ready To Move</option>
              <option>Completed</option>
            </select>
          </label>

          <label>
            Property type
            <select value={form.property_type} onChange={(e) => setField("property_type", e.target.value)}>
              <option>Residential</option>
              <option>Commercial</option>
            </select>
          </label>
        </section>

        {/* Configurations */}
        <div className="panel">
          <div className="panel-header">
            <h4>Configurations</h4>
            <small>Define unit types (e.g., 2 BHK / 3 BHK) with sizes and price ranges.</small>
          </div>

          <div className="configs">
            {form.configurations.map((c, idx) => (
              <div className="config-row" key={idx}>
                <input className="cfg-type" value={c.type} onChange={(e) => setConfigAt(idx, { type: e.target.value })} />
                <input className="cfg-small" placeholder="size min (sqft)" value={c.size_min} onChange={(e) => setConfigAt(idx, { size_min: e.target.value })} />
                <input className="cfg-small" placeholder="size max (sqft)" value={c.size_max} onChange={(e) => setConfigAt(idx, { size_max: e.target.value })} />
                <input className="cfg-small" placeholder="price min" value={c.price_min} onChange={(e) => setConfigAt(idx, { price_min: e.target.value })} />
                <input className="cfg-small" placeholder="price max" value={c.price_max} onChange={(e) => setConfigAt(idx, { price_max: e.target.value })} />
                <button type="button" className="btn small" onClick={() => removeConfiguration(idx)}>Remove</button>
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={addConfiguration} className="btn">+ Add configuration</button>
            </div>
          </div>
        </div>

        {/* Amenities & highlights */}
        <div className="grid-2">
          <div className="panel">
            <div className="panel-header"><h4>Amenities</h4></div>
            <div className="chip-row">
              <input value={amenityText} onChange={(e) => setAmenityText(e.target.value)} placeholder="e.g. Gymnasium" />
              <button type="button" className="btn" onClick={addAmenity}>Add Amenity</button>
            </div>
            <div className="chips">{form.amenities.map((a, i) => (<span className="chip" key={i}>{a} <button type="button" onClick={() => removeAmenity(i)}>×</button></span>))}</div>
          </div>

          <div className="panel">
            <div className="panel-header"><h4>Highlights</h4></div>
            <div className="chip-row">
              <input value={highlightText} onChange={(e) => setHighlightText(e.target.value)} placeholder="e.g. Near Metro" />
              <button type="button" className="btn" onClick={addHighlight}>Add Highlight</button>
            </div>
            <div className="chips">{form.highlights.map((h, i) => (<span className="chip" key={i}>{h} <button type="button" onClick={() => removeHighlight(i)}>×</button></span>))}</div>
          </div>
        </div>

        {/* Gallery + Thumbnail picker */}
        <div className="panel">
          <div className="panel-header"><h4>Gallery</h4><small>Upload images (jpg/png). Select one image as listing thumbnail.</small></div>

          <div className="uploader-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onFileChange} style={{ display: "none" }} />
            <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>{uploading ? "Uploading..." : "Select & Upload"}</button>

            <button type="button" className="btn" onClick={async () => { setShowUploadsModal(true); await fetchUploadsList(); }}>Select from uploads</button>
          </div>

          <div className="gallery-preview" style={{ marginTop: 12 }}>
            {form.gallery.map((g, i) => (
              <div key={i} className="gallery-item">
                <div className="gallery-thumb-wrap">
                  <img src={getImageUrl(g)} alt={`gallery-${i}`} />
                  <div className="gallery-controls">
                    <label className="thumb-radio">
                      <input type="radio" name="thumbnail" checked={form.thumbnail === g} onChange={() => setThumbnail(g)} />
                      <span>Thumbnail</span>
                    </label>
                    <button type="button" className="remove" onClick={() => removeGalleryItem(i)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
            {form.gallery.length === 0 && <div className="placeholder">No images yet.</div>}
          </div>
        </div>

        {/* YouTube Videos */}
        <div className="panel">
          <div className="panel-header">
            <h4>Property Videos (YouTube)</h4>
            <small>Add YouTube links for walkthroughs / promos. Thumbnails will be shown below.</small>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input
              value={videoUrlText}
              onChange={(e) => setVideoUrlText(e.target.value)}
              placeholder="Paste YouTube link or ID (e.g. https://youtu.be/VIDEOID)"
              style={{ flex: "1 1 auto" }}
            />
            <button type="button" className="btn" onClick={addVideo}>Add Video</button>
          </div>

          <div className="gallery-preview" style={{ marginTop: 8 }}>
            {form.videos && form.videos.length > 0 ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
               {form.videos.map((v, i) => (
  <div key={v.id || i} className="gallery-item video-item">
    {/* thumbnail background */}
    <div className="video-thumb-wrap" style={{ position: "relative", width: "100%", height: 110, overflow: "hidden" }}>
      <img
        className="video-thumb"
        src={v.thumbnail}
        alt={`video-${i}`}
        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`; }}
      />
      <button
        className="play-overlay"
        type="button"
        onClick={() => openVideoPreview(v)}
        title="Play video"
      >
        ▶
      </button>
    </div>

    {/* controls: only Preview & Remove */}
    <div className="video-controls">
      <button type="button" className="btn" onClick={() => openVideoPreview(v)}>Preview</button>
      <button type="button" className="btn" onClick={() => removeVideo(i)}>Remove</button>
    </div>
  </div>
))}

              </div>
            ) : (
              <div className="placeholder">No videos added.</div>
            )}
          </div>
        </div>

        {/* Developer Info */}
        <div className="panel">
          <div className="panel-header"><h4>Developer Info</h4><small>Enter details about the developer / builder. Pick from existing to autofill.</small></div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 700, color: "var(--muted)" }}>Select existing developer</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Dropdown
                id="developer-dropdown"
                value={developerSelected}
                onChange={(val) => {
                  setDeveloperSelected(val || "");
                  if (!val || val === "" || val === "__empty__" || val === "custom") {
                    setField("developer_name", "");
                    setField("developer_logo", "");
                    setField("developer_description", "");
                    return;
                  }
                  const d = developersList.find((x) => x.name === val);
                  if (d) {
                    setField("developer_name", d.name || "");
                    if (d.logo) setField("developer_logo", d.logo);
                    if (d.description) setField("developer_description", d.description);
                  }
                }}
                options={[
                  ...developersList.map((d) => ({ value: d.name, label: d.name })),
                  { value: "custom", label: "Other / Manual" }
                ]}
                placeholder="— Select developer —"
                className="developer-dropdown"
              />

              <button type="button" className="btn" onClick={() => fetchDevelopersList()} title="Refresh list">Refresh</button>
              <small style={{ color: "#777" }}>or choose "Other / Manual" to type new developer</small>
            </div>
          </div>

          <div className="grid-2">
            <label>
              Developer Name
              <input value={form.developer_name} onChange={(e) => { setField("developer_name", e.target.value); setDeveloperSelected("custom"); }} placeholder="e.g. ABC Developers" />
            </label>

            <label className="full">
              Developer Logo
              <div className="uploader-row" style={{ gap: "8px", flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={() => devLogoFileRef.current?.click()}>Upload Logo (PNG)</button>

                <button type="button" className="btn" onClick={async () => { developerLogoModeRef.current = true; setShowUploadsModal(true); await fetchUploadsList(); }}>
                  Select from uploads
                </button>

                <input type="text" value={form.developer_logo} onChange={(e) => { setField("developer_logo", e.target.value); setDeveloperSelected("custom"); }} placeholder="or paste image URL (https://...)" style={{ flex: "1 1 auto", minWidth: "220px" }} />

                <input
                  ref={devLogoFileRef}
                  type="file"
                  accept=".png,image/png"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    const [file] = files;
                    const isPng = file.type?.toLowerCase() === "image/png" || file.name?.toLowerCase().endsWith(".png");
                    if (!isPng) {
                      toast.error("Only PNG files are allowed for the developer logo.");
                      e.target.value = null;
                      return;
                    }
                    const uploaded = await uploadFiles([file], { silent: true });
                    if (uploaded.length) {
                      setField("developer_logo", uploaded[0]);
                      toast.success("Developer logo uploaded successfully (PNG)");
                    }
                    setDeveloperSelected("custom");
                    e.target.value = null;
                  }}
                />
              </div>

              {form.developer_logo && (
                <div className="developer-logo-preview">
                  <img src={getImageUrl(form.developer_logo)} alt="Developer Logo" />
                  <button type="button" className="remove" onClick={() => { setField("developer_logo", ""); setDeveloperSelected("custom"); }}>×</button>
                </div>
              )}
            </label>
          </div>

          <label className="full">
            Developer Description
            <textarea value={form.developer_description} onChange={(e) => { setField("developer_description", e.target.value); setDeveloperSelected("custom"); }} placeholder="Short developer profile or tagline" />
          </label>
        </div>

        {/* metadata fields + contact/brochure */}
        <section className="grid-2">
          <label>
            Blocks
            <input value={form.blocks} onChange={(e) => setField("blocks", e.target.value)} placeholder="e.g. A, B, C or 2" />
          </label>

          <label>
            Units
            <input value={form.units} onChange={(e) => setField("units", e.target.value)} placeholder="Total units (number)" />
          </label>

          <label>
            Floors
            <input value={form.floors} onChange={(e) => setField("floors", e.target.value)} placeholder="Number of floors" />
          </label>

          <label>
            Land Area
            <input value={form.land_area} onChange={(e) => setField("land_area", e.target.value)} placeholder="What is the land_area" />
          </label>

          <label>
            Brochure URL
            <input value={form.brochure_url} onChange={(e) => setField("brochure_url", e.target.value)} placeholder="https://..." />
          </label>

          <label>
            Price info (JSON optional)
            <input value={form.price_info ? JSON.stringify(form.price_info) : ""} onChange={(e) => { try { setField("price_info", e.target.value ? JSON.parse(e.target.value) : null); } catch {} }} placeholder='e.g. [{"type":"3 BHK","price_min":"1.2 Cr","price_max":"1.6 Cr"}]' />
          </label>

          <label>
            Contact phone
            <input value={form.contact_phone} onChange={(e) => setField("contact_phone", e.target.value)} placeholder="+91..." />
          </label>

          <label>
            Contact email
            <input type="email" value={form.contact_email} onChange={(e) => setField("contact_email", e.target.value)} placeholder="sales@example.com" />
          </label>
        </section>

        <div className="form-actions" style={{ marginTop: 18 }}>
          <button type="submit" className="btn" disabled={loading}>{loading ? "Saving..." : "Save Project"}</button>
          <button type="button" className="btn" onClick={() => navigate("/admin/projects")} disabled={loading}>Cancel</button>
        </div>
      </form>

      {/* -------- Uploads modal (select existing) -------- */}
      {showUploadsModal && (
        <div className="modal-backdrop" onClick={() => { developerLogoModeRef.current = false; setShowUploadsModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Select images from uploads</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => setSelectedUploads(new Set())}>Clear</button>
                <button className="btn" onClick={() => { developerLogoModeRef.current = false; setShowUploadsModal(false); }}>Close</button>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              {uploadsLoading ? <div>Loading images…</div> : uploadsList.length === 0 ? <div style={{ color: "#666" }}>No uploads found on server (endpoint /api/uploads).</div> : null}
            </div>

            <div className="uploads-grid">
              {uploadsList.map((u, idx) => {
                const url = getImageUrl(u) || u;
                const normalizePath = (p) => {
                  if (!p) return "";
                  let s = String(p).trim();
                  if (typeof BACKEND_BASE === "string" && BACKEND_BASE && s.startsWith(BACKEND_BASE)) s = s.replace(BACKEND_BASE, "");
                  if (!s.startsWith("/")) s = "/" + s;
                  return s;
                };

                const inGallery = form.gallery.some((g) => normalizePath(g) === normalizePath(u));
                const isThumbnail = normalizePath(form.thumbnail) === normalizePath(u);
                const isSelected = selectedUploads.has(u);
                const disabled = inGallery;

                return (
                  <div key={idx} className={`image-card ${disabled ? "disabled" : ""} ${isSelected ? "selected" : ""}`} onClick={() => { if (!disabled) toggleUploadSelect(u); }} title={disabled ? "Already added to gallery" : isSelected ? "Click to unselect" : "Click to select"}>
                    <div className="media"><img src={url} alt={`upload-${idx}`} /></div>

                    <div className="meta">
                      <label className="select-label">
                        <input type="checkbox" checked={isSelected} onChange={(e) => { if (!disabled) toggleUploadSelect(u); }} disabled={disabled} />
                        <span>{disabled ? "In gallery" : "Select"}</span>
                      </label>

                      {isThumbnail && <span className="thumb-badge">✓ Thumbnail</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => { developerLogoModeRef.current = false; setShowUploadsModal(false); }}>Cancel</button>

              <button className="btn primary" onClick={() => {
                const picked = Array.from(selectedUploads || []);
                if (picked.length === 0) { toast.error("No images selected"); return; }

                if (developerLogoModeRef.current) {
                  const first = picked[0];
                  setField("developer_logo", first);
                  toast.success("Developer logo set from uploads");
                  developerLogoModeRef.current = false;
                  setShowUploadsModal(false);
                  return;
                }

                setForm((s) => {
                  const combined = [...(s.gallery || []), ...picked];
                  const unique = Array.from(new Set(combined));
                  const thumbnail = s.thumbnail || unique[0] || "";
                  return { ...s, gallery: unique, thumbnail };
                });
                setSelectedUploads(new Set());
                setShowUploadsModal(false);
                toast.success(`Added ${picked.length} image(s) to gallery`);
              }} disabled={selectedUploads && selectedUploads.size === 0}>
                Add selected ({selectedUploads ? selectedUploads.size : 0})
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Video preview modal */}
      {videoPreviewModal && (
        <div className="modal-backdrop" onClick={closeVideoPreview}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: "min(95%, 900px)", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Video preview</h3>
              <div>
                <button className="btn" onClick={closeVideoPreview}>Close</button>
              </div>
            </div>

            <div style={{ position: "relative", paddingTop: "56.25%", background: "#000" }}>
              <iframe
                title="video-preview"
                src={`https://www.youtube.com/embed/${videoPreviewModal.id}?autoplay=1`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
