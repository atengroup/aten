// src/pages/admin/ImportProjects.jsx
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { auth } from "../../firebaseConfig";
import styles from "../../assets/pages/admin/ImportProjects.module.css";

/**
 * DEV_FALLBACK_IMAGE:
 * The uploaded file path you provided earlier. Use this as a dev fallback asset.
 * (Your dev tooling will transform /mnt/data/... to a served URL during testing)
 */
const DEV_FALLBACK_IMAGE = "/mnt/data/cd4227da-020a-4696-be50-0e519da8ac56.png";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

// ---- Helpers to get auth token safely ----
async function getAuthToken({ timeoutMs = 3000, intervalMs = 150 } = {}) {
  const start = Date.now();

  // small helper to read storages safely
  const readStored = () => {
    try {
      const l = localStorage.getItem("auth_token");
      if (l && l !== "null" && l !== "") return l;
    } catch (e) {}
    return null;
  };

  while (Date.now() - start < timeoutMs) {
    // 1) quick check storages
    const stored = readStored();
    if (stored) return stored;

    // 2) try Firebase currentUser token if available
    try {
      if (auth && auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken(false);
        if (idToken) {
          try { localStorage.setItem("auth_token", idToken); } catch (e) {}
          return idToken;
        }
      }
    } catch (err) {
      // non-fatal
    }

    await new Promise((res) => setTimeout(res, intervalMs));
  }

  try {
    if (auth && auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken(true);
      if (idToken) {
        try { localStorage.setItem("auth_token", idToken); } catch (e) {}
        try { sessionStorage.setItem("auth_token", idToken); } catch (e) {}
        return idToken;
      }
    }
  } catch (err) {
    // ignore
  }

  return null;
}

async function makeHeaders() {
  const token = await getAuthToken();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export default function ImportProjects() {
  const [excelFile, setExcelFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);
  const navigate = useNavigate();

  // ---- Import Excel ----
  const handleImportExcel = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      toast.error("Please select an Excel (.xlsx) file first");
      return;
    }

    const fd = new FormData();
    fd.append("file", excelFile);
    setLoadingExcel(true);

    try {
      const headers = await makeHeaders();
      const res = await fetch(`${BACKEND_BASE}/api/import-projects`, {
        method: "POST",
        headers,
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server ${res.status}`);
      }
      const j = await res.json();
      toast.success(`Imported ${j.imported || 0} projects successfully!`);
      navigate("/admin/projects");
    } catch (err) {
      console.error("Excel import error:", err);
      toast.error("Import failed: " + (err.message || "error"));
    } finally {
      setLoadingExcel(false);
    }
  };

  // ---- Import Images ZIP ----
  const handleImportZip = async (e) => {
    e.preventDefault();
    if (!zipFile) {
      toast.error("Please select a ZIP file first");
      return;
    }

    const fd = new FormData();
    fd.append("images_zip", zipFile);
    setLoadingZip(true);

    try {
      const headers = await makeHeaders();
      const res = await fetch(`${BACKEND_BASE}/api/import-images`, {
        method: "POST",
        headers,
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server ${res.status}`);
      }
      await res.json();
      toast.success(`Uploaded images successfully!`);
      navigate("/admin/projects");
    } catch (err) {
      console.error("ZIP upload error:", err);
      toast.error("Image ZIP upload failed: " + (err.message || "error"));
    } finally {
      setLoadingZip(false);
    }
  };

  return (
    <div className={styles.importShell}>
      <div className={styles.importInner}>
        <h2 className={styles.importTitle}>Import Projects Data & Images</h2>
        <p className={styles.importDesc}>
          Upload project data and gallery images separately. The Excel file
          defines project details, and the ZIP file can contain referenced
          images.
        </p>

        {/* --- Excel Import Section --- */}
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>1️⃣ Import Property Data (Excel)</h3>

          <form onSubmit={handleImportExcel} className={styles.formGrid}>
            <div className={styles.fileRow}>
              <input
                id="excelFile"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setExcelFile(e.target.files[0] || null)}
                className={styles.nativeFile}
              />
              <label htmlFor="excelFile" className={styles.fileBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 2v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 7l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 21H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Choose Excel
              </label>
              <div className={styles.fileName}>
                {excelFile ? excelFile.name : <span className="muted">No file selected</span>}
              </div>
            </div>

            <div className={styles.formActionsRow}>
              <button
                type="submit"
                className={`${styles.btn} ${styles.primaryBtn}`}
                disabled={loadingExcel}
              >
                {loadingExcel ? "Importing..." : "Import Excel"}
              </button>

              <button
                type="button"
                className={`${styles.btn} ${styles.ghostBtn}`}
                onClick={() => navigate("/admin/projects")}
              >
                Cancel
              </button>
            </div>
          </form>

          <div className={styles.notes}>
            <strong>Notes:</strong>
            <ul>
              <li>First sheet is used.</li>
              <li>Required columns: <code>title</code>, <code>city</code>.</li>
              <li>Gallery column: comma-separated URLs or filenames (if using ZIP).</li>
              <li>Highlights / Amenities: comma-separated or JSON array.</li>
              <li>Configurations: JSON or leave blank for default.</li>
            </ul>
          </div>
        </section>

        {/* --- ZIP Import Section --- */}
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>2️⃣ Import Gallery Images (ZIP)</h3>

          <form onSubmit={handleImportZip} className={styles.formGrid}>
            <div className={styles.fileRow}>
              <input
                id="zipFile"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setZipFile(e.target.files[0] || null)}
                className={styles.nativeFile}
              />
              <label htmlFor="zipFile" className={styles.fileBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M21 10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 1 1 2-2h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Choose ZIP
              </label>
              <div className={styles.fileName}>
                {zipFile ? zipFile.name : <span className="muted">No file selected</span>}
              </div>
            </div>

            <div className={styles.formActionsRow}>
              <button
                type="submit"
                className={`${styles.btn} ${styles.secondaryBtn}`}
                disabled={loadingZip}
              >
                {loadingZip ? "Uploading..." : "Upload Images ZIP"}
              </button>
            </div>
          </form>

          <div className={styles.notes}>
            <strong>Tip:</strong> If your Excel <code>gallery</code> column contains only filenames,
            upload the ZIP with those exact filenames so the importer can link them.
          </div>
        </section>
      </div>
    </div>
  );
}
