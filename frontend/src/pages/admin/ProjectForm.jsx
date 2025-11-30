// src/pages/admin/ProjectForm.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import styles from "../../assets/pages/admin/ProjectForm.module.css";
import { getImageUrl } from "../../lib/api";
import Dropdown from "../../components/Dropdown";
import { auth } from "../../firebaseConfig";

import ProjectBasicInfoSection from "./ProjectBasicInfoSection";
import ProjectDetailsSection from "./ProjectDetailsSection";
import ProjectDeveloperSection from "./ProjectDeveloperSection";
import ProjectOtherDetailsSection from "./ProjectOtherDetailsSection";

const DEV_FALLBACK_IMAGE = "/mnt/data/cd4227da-020a-4696-be50-0e519da8ac56.png";

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

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

// ---------- Auth helpers ----------
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
          try {
            localStorage.setItem("auth_token", idToken);
          } catch {}
          try {
            sessionStorage.setItem("auth_token", idToken);
          } catch {}
          return idToken;
        }
      }
    } catch {}

    await new Promise((res) => setTimeout(res, intervalMs));
  }

  try {
    if (auth && auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken(true);
      if (idToken) {
        try {
          localStorage.setItem("auth_token", idToken);
        } catch {}
        try {
          sessionStorage.setItem("auth_token", idToken);
        } catch {}
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

// ---------- misc helpers ----------
function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = String(url).trim();
    const patterns = [
      /(?:youtube\.com\/.*(?:\?|&)v=)([a-zA-Z0-9_-]{6,})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/,
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{6,})/,
    ];
    for (const re of patterns) {
      const m = u.match(re);
      if (m && m[1]) return m[1];
    }
    if (/^[a-zA-Z0-9_-]{6,}$/.test(u)) return u;
  } catch {}
  return null;
}

function makeYoutubeThumbUrl(id) {
  if (!id) return "";
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

function canonicalStoragePath(val) {
  if (!val) return "";
  let s = String(val).trim();
  if (!s) return "";
  if (/^\/\/.*/.test(s)) {
    try {
      s = window.location.protocol + s;
    } catch (e) {}
  }
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      s = u.pathname || s;
    }
  } catch (e) {}
  const BACKEND_BASE_LOCAL = import.meta.env.VITE_BACKEND_BASE || "";
  if (BACKEND_BASE_LOCAL && s.startsWith(BACKEND_BASE_LOCAL)) {
    s = s.slice(BACKEND_BASE_LOCAL.length);
  }
  s = s.replace(/^\/+/, "");
  s = "/" + s;
  return s;
}

// Convert a jpg/jpeg file to webp using a canvas.
async function convertJpegToWebP(file) {
  const isJpegType =
    file.type === "image/jpeg" ||
    file.type === "image/jpg" ||
    /\.jpe?g$/i.test(file.name || "");

  if (!isJpegType) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    const img = new Image();

    reader.onload = (e) => {
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);

          if (!canvas.toBlob) {
            resolve(file);
            return;
          }

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const newName = (file.name || "image")
                .replace(/\.(jpe?g|JPE?G)$/g, "")
                .concat(".webp");
              const webpFile = new File([blob], newName, {
                type: "image/webp",
              });
              resolve(webpFile);
            },
            "image/webp",
            0.9
          );
        } catch (err) {
          console.error("WebP conversion failed, using original file", err);
          resolve(file);
        }
      };

      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function ProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const developerLogoModeRef = useRef(false);
  const devLogoFileRef = useRef(null);
  const brochureFileRef = useRef(null);
  const docFileRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [developersList, setDevelopersList] = useState([]);
  const [developerSelected, setDeveloperSelected] = useState("");

  const [docUploading, setDocUploading] = useState(false);
  const [docPreview, setDocPreview] = useState(null);
  const [activeSection, setActiveSection] = useState("basic"); // basic | details | developer | other

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
    videos: [],
    other_documents: [],
  });

  const [amenityText, setAmenityText] = useState("");
  const [highlightText, setHighlightText] = useState("");
  const [showUploadsModal, setShowUploadsModal] = useState(false);
  const [uploadsList, setUploadsList] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [selectedUploads, setSelectedUploads] = useState(new Set());
  const [videoUrlText, setVideoUrlText] = useState("");
  const [videoPreviewModal, setVideoPreviewModal] = useState(null);

  const openDocPreview = (doc) => setDocPreview(doc);
  const closeDocPreview = () => setDocPreview(null);
  // ---------- Section-specific instructions ----------
  const renderInstructions = () => {
    switch (activeSection) {
      case "basic":
        return (
          <div className={styles.instructions}>
            <h3>Basic Info – how to fill</h3>
            <ul>
              <li><strong>Title</strong>: Marketing name of the project (e.g. “DTC Skyler”).</li>
              <li><strong>Slug</strong>: URL-friendly id; leave blank to auto-generate.</li>
              <li><strong>City & Location area</strong>: Used for search filters and listing cards.</li>
              <li><strong>Address</strong>: Short but clear address / landmark for users.</li>
              <li><strong>Description</strong>: 3–6 lines that describe the project at a high level.</li>
              <li><strong>Status & Property Type</strong>: Drives labels like “Under Construction”, “Residential”, etc.</li>
            </ul>
          </div>
        );

      case "details":
        return (
          <div className={styles.instructions}>
            <h3>Details – units, highlights & media</h3>
            <ul>
              <li><strong>Configurations</strong>: Each row is a unit type (e.g. 2 BHK) with size and price range.</li>
              <li><strong>Amenities</strong>: Add one per line (Gym, Pool, Community Hall, etc.).</li>
              <li><strong>Highlights</strong>: Short bullet points that sell the project (Near Metro, Lake-facing, etc.).</li>
              <li><strong>Gallery</strong>: Upload images; choose 1 image as the listing thumbnail.</li>
              <li><strong>Videos</strong>: Paste YouTube URLs / IDs for walkthroughs and promos.</li>
            </ul>
          </div>
        );

      case "developer":
        return (
          <div className={styles.instructions}>
            <h3>Developer Info – brand & profile</h3>
            <ul>
              <li><strong>Select existing developer</strong> to reuse name, logo and description from other projects.</li>
              <li>Use <strong>Other / Manual</strong> to type a new developer.</li>
              <li><strong>Developer Name</strong>: Brand name that should show on listings.</li>
              <li><strong>Developer Logo</strong>: PNG logo; either upload or paste an image URL.</li>
              <li><strong>Developer Description</strong>: 2–4 lines about the builder, track record, or tagline.</li>
            </ul>
          </div>
        );

      case "other":
      default:
        return (
          <div className={styles.instructions}>
            <h3>Other Details – documents & contact</h3>
            <ul>
              <li><strong>Blocks / Units / Floors</strong>: Shown as project stats on the detail page.</li>
              <li><strong>Land Area</strong>: Total project land area (with unit in the text).</li>
              <li><strong>Brochure</strong>: Upload a PDF or paste a brochure URL.</li>
              <li><strong>Other Documents</strong>: Floor plans, payment schedules, T&Cs, etc.</li>
              <li>You can <strong>rename</strong> each document and <strong>remove</strong> it (deletes from bucket too).</li>
              <li><strong>Contact phone / email</strong>: Lead contact details that show on the project.</li>
            </ul>
          </div>
        );
    }
  };

  // ---------- Developers list ----------
  async function fetchDevelopersList() {
    try {
      const headers = await makeHeaders();
      const res = await fetch(`${BACKEND_BASE}/api/projects`, { headers });
      if (!res.ok) throw new Error(`projects endpoint failed: ${res.status}`);
      const body = await res.json().catch(() => null);
      const rawItems = Array.isArray(body)
        ? body
        : body && Array.isArray(body.items)
        ? body.items
        : [];
      const map = new Map();
      for (const it of rawItems) {
        const name = (
          (it &&
            (it.developer_name ||
              it.developer ||
              (it.developer && it.developer.name))) ||
          ""
        )
          .toString()
          .trim();
        if (!name) continue;
        const logo = (
          (it &&
            (it.developer_logo ||
              it.logo ||
              (it.developer && it.developer.logo))) ||
          ""
        )
          .toString()
          .trim();
        const description = (
          (it &&
            (it.developer_description ||
              (it.developer && it.developer.description))) ||
          ""
        )
          .toString()
          .trim();
        if (!map.has(name)) map.set(name, { name, logo, description });
      }
      setDevelopersList(
        Array.from(map.values()).map((d) => ({
          name: d.name,
          logo: d.logo || "",
          description: d.description || "",
        }))
      );
    } catch (err) {
      console.warn("Could not load developers list:", err);
      setDevelopersList([]);
    }
  }

  useEffect(() => {
    fetchDevelopersList();
  }, []);

  // ---------- Load/edit project ----------
  useEffect(() => {
    if (!id || id === "new") return;
    (async () => {
      setLoading(true);
      try {
        const headers = await makeHeaders();
        let res = await fetch(
          `${BACKEND_BASE}/api/projects/${encodeURIComponent(id)}`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const p = data?.project || data;
          if (p) fillFormFromProject(p);
          setLoading(false);
          return;
        }
        const listRes = await fetch(`${BACKEND_BASE}/api/projects`, {
          headers,
        });
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
    const configs = safeParseJson(
      p.configurations,
      p.configurations && p.configurations.length
        ? p.configurations
        : [emptyConfig()]
    );
    const price_info =
      p.price_info && typeof p.price_info === "string"
        ? (() => {
            try {
              return JSON.parse(p.price_info);
            } catch {
              return p.price_info;
            }
          })()
        : p.price_info || null;
    const videos = safeParseJson(
      p.videos || p.video || p.videos_json || [],
      []
    );
    const otherDocs = safeParseJson(p.other_documents || [], []);

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
      thumbnail:
        p.thumbnail ||
        (Array.isArray(gallery) && gallery.length ? gallery[0] : ""),
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
      other_documents: Array.isArray(otherDocs) ? otherDocs : [],
    }));
  }

  const setField = (field, value) =>
    setForm((s) => ({ ...s, [field]: value }));

  // ---------- Configs ----------
  const setConfigAt = (idx, obj) =>
    setForm((s) => ({
      ...s,
      configurations: s.configurations.map((c, i) =>
        i === idx ? { ...c, ...obj } : c
      ),
    }));

  const addConfiguration = () =>
    setForm((s) => ({
      ...s,
      configurations: [...s.configurations, emptyConfig()],
    }));

  const removeConfiguration = (idx) =>
    setForm((s) => ({
      ...s,
      configurations: s.configurations.filter((_, i) => i !== idx),
    }));

  // ---------- amenities / highlights ----------
  const addAmenity = () => {
    const txt = amenityText.trim();
    if (!txt) {
      toast.error("Amenity is empty");
      return;
    }
    setForm((s) => ({
      ...s,
      amenities: [...s.amenities, txt],
    }));
    setAmenityText("");
    toast.success("Amenity added");
  };

  const removeAmenity = (i) =>
    setForm((s) => ({
      ...s,
      amenities: s.amenities.filter((_, idx) => idx !== i),
    }));

  const addHighlight = () => {
    const txt = highlightText.trim();
    if (!txt) {
      toast.error("Highlight is empty");
      return;
    }
    setForm((s) => ({
      ...s,
      highlights: [...s.highlights, txt],
    }));
    setHighlightText("");
    toast.success("Highlight added");
  };

  const removeHighlight = (i) =>
    setForm((s) => ({
      ...s,
      highlights: s.highlights.filter((_, idx) => idx !== i),
    }));

  // ---------- Image uploads ----------
  async function uploadFiles(files, options = {}) {
    if (!files || files.length === 0) return [];
    setUploading(true);
    const uploadedUrls = [];
    const toastId = options.silent
      ? null
      : toast.loading("Uploading images...");
    try {
      for (const file of Array.from(files)) {
        const fileToUpload = await convertJpegToWebP(file);

        const formData = new FormData();
        formData.append("file", fileToUpload);

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
          if (!options.silent)
            toast.error(`Upload failed: ${res.status}`, {
              id: toastId,
            });
          continue;
        }

        const j = await res.json().catch(() => null);
        if (j && j.url) uploadedUrls.push(j.url);
        else if (j && j.path) uploadedUrls.push(getImageUrl(j.path));
        else if (j && j.filename)
          uploadedUrls.push(getImageUrl(`/uploads/${j.filename}`));
        else if (typeof j === "string") uploadedUrls.push(j);
      }

      if (uploadedUrls.length && options.addToGallery !== false) {
        setForm((s) => {
          const newGallery = [...s.gallery, ...uploadedUrls];
          const seen = new Set();
          const unique = [];
          for (const item of newGallery) {
            const cp = canonicalStoragePath(item);
            if (!seen.has(cp)) {
              seen.add(cp);
              unique.push(item);
            }
          }
          const thumbnail = s.thumbnail || unique[0] || "";
          return { ...s, gallery: unique, thumbnail };
        });
        if (!options.silent)
          toast.success(`Uploaded ${uploadedUrls.length} image(s)`, {
            id: toastId,
          });
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
      const newThumbnail =
        s.thumbnail === s.gallery[i] ? newGallery[0] || "" : s.thumbnail;
      return { ...s, gallery: newGallery, thumbnail: newThumbnail };
    });
    toast.success("Image removed");
  };

  const setThumbnail = (url) => {
    setForm((s) => ({ ...s, thumbnail: url }));
    toast.success("Thumbnail selected");
  };

  // ---------- Brochure upload ----------
  async function uploadBrochureFile(file) {
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "brochure");

    const toastId = toast.loading("Uploading brochure...");
    try {
      const headers = await makeHeaders();
      if (headers["Content-Type"]) delete headers["Content-Type"];

      const res = await fetch(`${BACKEND_BASE}/api/uploads`, {
        method: "POST",
        headers,
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server ${res.status}`);
      }

      const j = await res.json().catch(() => ({}));

      const publicUrl =
        j.publicUrl ||
        j.public_url ||
        j.url ||
        (j.path ? getImageUrl(j.path) : null);

      if (!publicUrl) {
        throw new Error("Upload succeeded but no URL returned from server");
      }

      setField("brochure_url", publicUrl);
      toast.success("Brochure uploaded", { id: toastId });
    } catch (err) {
      console.error("Brochure upload error:", err);
      toast.error(err.message || "Brochure upload failed", { id: toastId });
    } finally {
      if (brochureFileRef.current) brochureFileRef.current.value = null;
    }
  }

  // ---------- Other documents upload/delete/rename ----------
  async function uploadOtherDocument(file) {
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "other_documents");

    const toastId = toast.loading("Uploading document...");
    setDocUploading(true);
    try {
      const headers = await makeHeaders();
      if (headers["Content-Type"]) delete headers["Content-Type"];

      const res = await fetch(`${BACKEND_BASE}/api/uploads`, {
        method: "POST",
        headers,
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server ${res.status}`);
      }

      const j = await res.json().catch(() => ({}));

      const publicUrl =
        j.publicUrl ||
        j.public_url ||
        j.url ||
        (j.path ? getImageUrl(j.path) : null);

      if (!publicUrl) {
        throw new Error("Upload succeeded but no URL returned from server");
      }

      const originalName = file.name || "document";
      const baseName = originalName.replace(/\.[^/.]+$/g, "");
      const ext = (originalName.split(".").pop() || "").toLowerCase();

      const entry = {
        id: Date.now(),
        name: baseName,
        url: publicUrl,
        path: j.path || null,
        type: file.type || "application/octet-stream",
        ext,
        original_name: originalName,
      };

      setForm((s) => ({
        ...s,
        other_documents: [...(s.other_documents || []), entry],
      }));

      toast.success("Document uploaded", { id: toastId });
    } catch (err) {
      console.error("Other document upload error:", err);
      toast.error(err.message || "Document upload failed", { id: toastId });
    } finally {
      setDocUploading(false);
      if (docFileRef.current) docFileRef.current.value = null;
    }
  }

  async function deleteOtherDocument(idx, doc) {
    if (!doc) return;

    const sure = window.confirm(
      `Remove "${doc.name || doc.original_name || "this document"}"? This will also delete it from storage.`
    );
    if (!sure) return;

    const toastId = toast.loading("Removing document...");
    try {
      if (doc.path) {
        const headers = await makeHeaders({ forJson: true });
        const res = await fetch(`${BACKEND_BASE}/api/uploads`, {
          method: "DELETE",
          headers,
          body: JSON.stringify({ path: doc.path }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Server ${res.status}`);
        }
      }

      setForm((s) => ({
        ...s,
        other_documents: (s.other_documents || []).filter(
          (_, i) => i !== idx
        ),
      }));

      toast.success("Document removed", { id: toastId });
    } catch (err) {
      console.error("Delete other_document error:", err);
      toast.error(err.message || "Failed to remove document", { id: toastId });
    }
  }

  async function confirmRenameOtherDocument(doc, newName, index, onSuccess) {
    const trimmed = (newName || "").trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }

    const toastId = toast.loading("Renaming document...");
    try {
      let newPath = doc.path || null;
      let newUrl = doc.url;

      if (doc.path) {
        const headers = await makeHeaders({ forJson: true });
        const res = await fetch(`${BACKEND_BASE}/api/uploads/rename`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            oldPath: doc.path,
            newName: trimmed,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Server ${res.status}`);
        }

        const data = await res.json();
        newPath = data.path || newPath;
        newUrl = data.url || newUrl;
      }

      setForm((s) => {
        const arr = [...(s.other_documents || [])];
        if (!arr[index]) return s;
        arr[index] = {
          ...arr[index],
          name: trimmed,
          path: newPath,
          url: newUrl,
        };
        return { ...s, other_documents: arr };
      });

      if (typeof onSuccess === "function") onSuccess();

      toast.success("Document renamed", { id: toastId });
    } catch (err) {
      console.error("Rename other_document error:", err);
      toast.error(err.message || "Failed to rename document", { id: toastId });
    }
  }

  // ---------- Uploads gallery modal ----------
  async function fetchUploadsList() {
    setUploadsLoading(true);
    setUploadsList([]);
    setSelectedUploads(new Set());
    try {
      const headers = await makeHeaders();
      const res = await fetch(`${BACKEND_BASE}/api/uploads`, { headers });
      if (!res.ok)
        throw new Error(`Uploads listing failed: ${res.status}`);
      const body = await res.json().catch(() => null);
      let arr = [];
      if (Array.isArray(body)) {
        arr = body
          .map((item) => {
            if (!item) return null;
            const signed = item.signedUrl || item.signed_url || null;
            const publicUrl =
              item.publicUrl || item.public_url || item.url || null;
            const srcCandidate =
              signed ||
              publicUrl ||
              (item.path ? getImageUrl(item.path) : null) ||
              (typeof item === "string" ? getImageUrl(item) : null);
            const storageKey = item.path || item.name || null;
            const canonical = storageKey
              ? canonicalStoragePath(storageKey)
              : canonicalStoragePath(srcCandidate);
            if (!srcCandidate || !canonical) return null;
            return { src: srcCandidate, path: canonical, raw: item };
          })
          .filter(Boolean);
      } else {
        throw new Error("Unexpected uploads response shape");
      }
      setUploadsList(arr);
    } catch (err) {
      console.error("Failed to fetch uploads list:", err);
      toast.error(
        "Failed to load uploads list. Check backend endpoint /api/uploads"
      );
    } finally {
      setUploadsLoading(false);
    }
  }

  const openUploadsModal = async () => {
    setShowUploadsModal(true);
    await fetchUploadsList();
  };

  const toggleUploadSelect = (canonicalPath) => {
    setSelectedUploads((prev) => {
      const s = new Set(prev);
      if (s.has(canonicalPath)) s.delete(canonicalPath);
      else s.add(canonicalPath);
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
      const newGallery = [
        ...s.gallery,
        ...picked.map((p) => {
          const found = uploadsList.find((x) => x.path === p);
          return found ? found.src : p;
        }),
      ];
      const seen = new Set();
      const unique = [];
      for (const item of newGallery) {
        const cp = canonicalStoragePath(item);
        if (!seen.has(cp)) {
          seen.add(cp);
          unique.push(item);
        }
      }
      const thumbnail = s.thumbnail || unique[0] || "";
      return { ...s, gallery: unique, thumbnail };
    });
    toast.success(`Added ${picked.length} image(s) to gallery`);
    setShowUploadsModal(false);
  };

  // ---------- Videos ----------
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
      const obj = {
        id: vid,
        url: `https://www.youtube.com/watch?v=${vid}`,
        thumbnail,
      };
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

  const openVideoPreview = (video) => setVideoPreviewModal(video);
  const closeVideoPreview = () => setVideoPreviewModal(null);

  // ---------- Submit ----------
  const handleSubmit = async ({ navigateAfter = false } = {}) => {
    if (!form.title || !form.city) {
      toast.error("Please fill Title and City (required).");
      return;
    }
    setLoading(true);
    const tid = toast.loading("Saving project...");
    try {
      const payload = {
        ...form,
        gallery: JSON.stringify(form.gallery || []),
        highlights: JSON.stringify(form.highlights || []),
        amenities: JSON.stringify(form.amenities || []),
        configurations: JSON.stringify(form.configurations || []),
        videos: JSON.stringify(form.videos || []),
        other_documents: JSON.stringify(form.other_documents || []),
        price_info: form.price_info
          ? JSON.stringify(form.price_info)
          : null,
      };
      const method = id && id !== "new" ? "PUT" : "POST";
      const url =
        id && id !== "new"
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
        if (navigateAfter) navigate("/admin/projects");
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

  const galleryCanonicalSet = new Set(
    (form.gallery || []).map(canonicalStoragePath)
  );

  // ---------- Render ----------
  return (
    <div className={styles.projectFormShell}>
      <form
        className={styles.projectForm}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit({ navigateAfter: false });
        }}
      >
        <h2 className={styles.title}>
          {id && id !== "new" ? "Edit Project" : "Add Project"}
        </h2>

             {renderInstructions()}

        {/* Stepper / progress buttons */}
        <div
          style={{
            display: "flex",
            gap: 8,
            margin: "16px 0 12px",
            flexWrap: "wrap",
          }}
        >
          {[
            { id: "basic", label: "1. Basic Info" },
            { id: "details", label: "2. Details" },
            { id: "developer", label: "3. Developer Info" },
            { id: "other", label: "4. Other Details" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={styles.btn}
              style={{
                flex: "1 1 120px",
                fontWeight: 600,
                borderRadius: 999,
                border:
                  activeSection === s.id
                    ? "2px solid var(--accent)"
                    : "1px solid rgba(0,0,0,0.1)",
                background:
                  activeSection === s.id ? "var(--accent-soft)" : "#fff",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Sections */}
        {activeSection === "basic" && (
          <ProjectBasicInfoSection form={form} setField={setField} />
        )}

        {activeSection === "details" && (
          <ProjectDetailsSection
            form={form}
            setField={setField}
            amenityText={amenityText}
            setAmenityText={setAmenityText}
            highlightText={highlightText}
            setHighlightText={setHighlightText}
            addAmenity={addAmenity}
            removeAmenity={removeAmenity}
            addHighlight={addHighlight}
            removeHighlight={removeHighlight}
            configurations={form.configurations}
            setConfigAt={setConfigAt}
            addConfiguration={addConfiguration}
            removeConfiguration={removeConfiguration}
            fileInputRef={fileInputRef}
            uploading={uploading}
            onFileChange={onFileChange}
            gallery={form.gallery}
            thumbnail={form.thumbnail}
            setThumbnail={setThumbnail}
            removeGalleryItem={removeGalleryItem}
            openUploadsModal={openUploadsModal}
            videos={form.videos}
            videoUrlText={videoUrlText}
            setVideoUrlText={setVideoUrlText}
            addVideo={addVideo}
            removeVideo={removeVideo}
            openVideoPreview={openVideoPreview}
          />
        )}

        {activeSection === "developer" && (
          <ProjectDeveloperSection
            form={form}
            setField={setField}
            developersList={developersList}
            developerSelected={developerSelected}
            setDeveloperSelected={setDeveloperSelected}
            fetchDevelopersList={fetchDevelopersList}
            devLogoFileRef={devLogoFileRef}
            uploadFiles={uploadFiles}
          />
        )}

        {activeSection === "other" && (
          <ProjectOtherDetailsSection
            form={form}
            setField={setField}
            brochureFileRef={brochureFileRef}
            uploadBrochureFile={uploadBrochureFile}
            docFileRef={docFileRef}
            docUploading={docUploading}
            uploadOtherDocument={uploadOtherDocument}
            deleteOtherDocument={deleteOtherDocument}
            confirmRenameOtherDocument={confirmRenameOtherDocument}
            openDocPreview={openDocPreview}
          />
        )}

        {/* Actions */}
        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => handleSubmit({ navigateAfter: false })}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save this section"}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => handleSubmit({ navigateAfter: true })}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save all & return"}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => navigate("/admin/projects")}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Uploads modal */}
      {showUploadsModal && (
        <div
          className={styles.modalBackdrop}
          onClick={() => {
            developerLogoModeRef.current = false;
            setShowUploadsModal(false);
          }}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3 style={{ margin: 0 }}>Select images from uploads</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={styles.btn}
                  onClick={() => setSelectedUploads(new Set())}
                >
                  Clear
                </button>
                <button
                  className={styles.btn}
                  onClick={() => {
                    developerLogoModeRef.current = false;
                    setShowUploadsModal(false);
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              {uploadsLoading ? (
                <div>Loading images…</div>
              ) : uploadsList.length === 0 ? (
                <div style={{ color: "var(--muted-2)" }}>
                  No uploads found on server (endpoint /api/uploads).
                </div>
              ) : null}
            </div>

            <div className={styles.uploadsGrid}>
              {uploadsList.map((u, idx) => {
                const url = u.src;
                const path = u.path;
                const inGallery = galleryCanonicalSet.has(path);
                const isThumbnail =
                  canonicalStoragePath(form.thumbnail || "") === path;
                const isSelected =
                  inGallery || selectedUploads.has(path);
                const disabled = inGallery;
                return (
                  <div
                    key={idx}
                    className={`${styles.imageCard} ${
                      disabled ? styles.disabled : ""
                    } ${
                      isSelected ? styles.imageCardSelected : ""
                    }`}
                    onClick={() => {
                      if (!disabled) toggleUploadSelect(path);
                    }}
                    title={
                      disabled
                        ? "Already added to gallery"
                        : isSelected
                        ? "Click to unselect"
                        : "Click to select"
                    }
                  >
                    <div className={styles.media}>
                      <img
                        src={url || DEV_FALLBACK_IMAGE}
                        alt={`upload-${idx}`}
                      />
                    </div>
                    <div className={styles.meta}>
                      <label className={styles.selectLabel}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (!disabled)
                              toggleUploadSelect(path);
                          }}
                          disabled={disabled}
                        />
                        <span>
                          {disabled ? "In gallery" : "Select"}
                        </span>
                      </label>
                      {isThumbnail && (
                        <span
                          style={{
                            fontSize: 12,
                            padding: "4px 8px",
                            background: "var(--accent)",
                            color: "var(--btn-text)",
                            borderRadius: 6,
                          }}
                        >
                          ✓ Thumbnail
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                className={styles.btn}
                onClick={() => {
                  developerLogoModeRef.current = false;
                  setShowUploadsModal(false);
                }}
              >
                Cancel
              </button>

              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => {
                  const picked = Array.from(selectedUploads || []);
                  if (picked.length === 0) {
                    toast.error("No images selected");
                    return;
                  }

                  if (developerLogoModeRef.current) {
                    const firstPath = picked[0];
                    const found = uploadsList.find(
                      (x) => x.path === firstPath
                    );
                    if (found) {
                      setField("developer_logo", found.src);
                      toast.success("Developer logo set from uploads");
                    } else {
                      toast.error("Selected developer logo not found");
                    }
                    developerLogoModeRef.current = false;
                    setShowUploadsModal(false);
                    setSelectedUploads(new Set());
                    return;
                  }

                  const toAddSrcs = [];
                  const galleryPaths = new Set(
                    (form.gallery || []).map(canonicalStoragePath)
                  );
                  for (const p of picked) {
                    if (galleryPaths.has(p)) continue;
                    const found = uploadsList.find(
                      (x) => x.path === p
                    );
                    if (!found) continue;
                    toAddSrcs.push(found.src);
                    galleryPaths.add(p);
                  }

                  if (toAddSrcs.length === 0) {
                    toast.error("No new images to add");
                    setShowUploadsModal(false);
                    setSelectedUploads(new Set());
                    return;
                  }

                  setForm((s) => {
                    const combined = [
                      ...(s.gallery || []),
                      ...toAddSrcs,
                    ];
                    const seen = new Set();
                    const unique = [];
                    for (const item of combined) {
                      const cp = canonicalStoragePath(item);
                      if (!seen.has(cp)) {
                        seen.add(cp);
                        unique.push(item);
                      }
                    }
                    const thumbnail =
                      s.thumbnail || unique[0] || "";
                    return { ...s, gallery: unique, thumbnail };
                  });

                  setSelectedUploads(new Set());
                  setShowUploadsModal(false);
                  toast.success(
                    `Added ${toAddSrcs.length} image(s) to gallery`
                  );
                }}
                disabled={selectedUploads && selectedUploads.size === 0}
              >
                Add selected ({selectedUploads ? selectedUploads.size : 0})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Other document preview modal */}
      {docPreview && (
        <div className={styles.modalBackdrop} onClick={closeDocPreview}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 900,
              width: "min(95%, 1200px)",
              height: "min(95%, 90vh)",
              padding: 12,
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3 style={{ margin: 0 }}>
                {docPreview.name ||
                  docPreview.original_name ||
                  "Document preview"}
              </h3>
              <div>
                <button className={styles.btn} onClick={closeDocPreview}>
                  Close
                </button>
              </div>
            </div>

            {(docPreview.type || "").startsWith("image/") ? (
              <div style={{ maxHeight: "60vh", overflow: "auto" }}>
                <img
                  src={docPreview.url}
                  alt={docPreview.name || "Document"}
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    display: "block",
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  position: "relative",
                  paddingTop: "80%",
                  background: "#000",
                }}
              >
                <iframe
                  title="document-preview"
                  src={docPreview.url}
                  frameBorder="0"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video preview modal */}
      {videoPreviewModal && (
        <div
          className={styles.modalBackdrop}
          onClick={closeVideoPreview}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 900,
              width: "min(95%, 900px)",
              padding: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3 style={{ margin: 0 }}>Video preview</h3>
              <div>
                <button
                  className={styles.btn}
                  onClick={closeVideoPreview}
                >
                  Close
                </button>
              </div>
            </div>

            <div
              style={{
                position: "relative",
                paddingTop: "56.25%",
                background: "#000",
              }}
            >
              <iframe
                title="video-preview"
                src={`https://www.youtube.com/embed/${videoPreviewModal.id}?autoplay=1`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
