// src/pages/admin/ProjectsAdmin.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import styles from "../../assets/pages/admin/ProjectsAdmin.module.css";
import showDeleteConfirm from "../../components/ConfirmDeleteToast";
import { auth } from "../../firebaseConfig";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

// fallback dev image (uploaded asset)
const DEV_FALLBACK_IMAGE = "/mnt/data/cd4227da-020a-4696-be50-0e519da8ac56.png";

function safeParse(arrOrStr) {
  if (!arrOrStr) return [];
  if (Array.isArray(arrOrStr)) return arrOrStr;
  try { return JSON.parse(arrOrStr); } catch { return []; }
}

async function getAuthToken({ timeoutMs = 3000, intervalMs = 150 } = {}) {
  const start = Date.now();
  const readStored = () => {
    try {
      const l = localStorage.getItem("auth_token");
      if (l && l !== "null" && l !== "") return l;
    } catch (e) {}
    return null;
  };

  while (Date.now() - start < timeoutMs) {
    const stored = readStored();
    if (stored) return stored;

    try {
      if (auth && auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken(false);
        if (idToken) {
          try { localStorage.setItem("auth_token", idToken); } catch (e) {}
          return idToken;
        }
      }
    } catch (err) {}

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
  } catch (err) {}

  return null;
}

async function makeHeaders() {
  const token = await getAuthToken();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export default function ProjectsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]); // selected project ids

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE}/api/projects`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Server ${res.status} ${txt}`);
      }
      const data = await res.json();
      const list = (data.items || []).map((p) => ({ ...p, gallery: safeParse(p.gallery) }));
      setItems(list);
      setSelected([]);
    } catch (err) {
      console.error("Failed to load projects:", err);
      toast.error("Failed to load projects. Check server.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const performDelete = async (id) => {
    try {
      setLoading(true);
      const headers = await makeHeaders();
      const res = await fetch(`${BACKEND_BASE}/api/projects/${id}`, { method: "DELETE", headers });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Delete failed ${res.status} ${txt}`);
      }
      toast.success("Deleted");
      await load();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const performBulkDelete = async (ids) => {
    try {
      setLoading(true);
      const headers = await makeHeaders();
      for (const id of ids) {
        const res = await fetch(`${BACKEND_BASE}/api/projects/${id}`, { method: "DELETE", headers });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Delete failed for ${id} ${res.status} ${txt}`);
        }
      }
      toast.success(`Deleted ${ids.length} project${ids.length > 1 ? "s" : ""}`);
      await load();
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast.error("Bulk delete failed");
    } finally {
      setLoading(false);
    }
  };

  const remove = (id, title) => {
    showDeleteConfirm({
      title: `Delete "${title}"?`,
      message: "This will permanently delete the project.",
      onConfirm: () => performDelete(id),
    });
  };

  const removeSelected = () => {
    if (!selected.length) return;
    showDeleteConfirm({
      title: `Delete ${selected.length} selected project${selected.length > 1 ? "s" : ""}?`,
      message: "This will permanently delete all selected projects.",
      onConfirm: () => performBulkDelete(selected),
    });
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => {
    if (selected.length === items.length) setSelected([]);
    else setSelected(items.map((i) => i.id));
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h2>Projects</h2>
        <div className={styles.buttons}>
          <Link to="/admin/projects/new" className={`${styles.btn} ${styles.btnPrimary}`}>Add Project</Link>
          <Link to="/admin/import" className={`${styles.btn}`}>Bulk Import</Link>

          <button
            onClick={removeSelected}
            className={`${styles.btn} ${selected.length > 0 ? styles.btnDanger : styles.btnDisabled}`}
            disabled={selected.length === 0}
            aria-disabled={selected.length === 0}
          >
            Delete Selected
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.emptyState}>Loading…</div>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          No projects found.
          <div style={{ marginTop: 12 }}>
            <button onClick={load} className={`${styles.btn}`}>Reload</button>
          </div>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={selected.length === items.length && items.length > 0}
                    onChange={selectAll}
                    aria-label="Select all projects"
                  />
                </th>
                <th>Title</th>
                <th>City</th>
                <th>Slug</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      aria-label={`Select project ${r.title}`}
                    />
                  </td>

                  <td>{r.title}</td>
                  <td>{r.city}</td>
                  <td>{r.slug}</td>

                  <td className={styles.function}>
                    <Link className={styles.actionLink} to={`/admin/projects/${r.id}`}>Edit</Link>

                    <button
                      className={styles.actionDelete}
                      onClick={() => remove(r.id, r.title)}
                      aria-label={`Delete project ${r.title}`}
                      type="button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
