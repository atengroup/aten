// src/pages/admin/ProjectsAdmin.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import "../../assets/pages/admin/ProjectsAdmin.css";
import showDeleteConfirm from "../../components/ConfirmDeleteToast";
import { auth } from "../../firebaseConfig";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

function safeParse(arrOrStr) {
  if (!arrOrStr) return [];
  if (Array.isArray(arrOrStr)) return arrOrStr;
  try { return JSON.parse(arrOrStr); } catch { return []; }
}

// ---- Helpers to get auth token safely (copied/adapted from ImportProjects.jsx) ----
async function getAuthToken({ timeoutMs = 3000, intervalMs = 150 } = {}) {
  const start = Date.now();

  // small helper to read storages safely
  const readStored = () => {
    try {
      const l = localStorage.getItem("auth_token");
      if (l && l !== "null" && l !== "") return l;
    } catch (e) { /* ignore storage access errors */ }
    return null;
  };

  while (Date.now() - start < timeoutMs) {
    // 1) quick check storages
    const stored = readStored();
    if (stored) return stored;

    // 2) try Firebase currentUser token if available
    try {
      if (auth && auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken(false); // don't force refresh first
        if (idToken) {
          // cache for future sync
          try { localStorage.setItem("auth_token", idToken); } catch (e) {}
          return idToken;
        }
      }
    } catch (err) {
      // non-fatal: firebase might not be ready yet
    }

    // wait briefly then retry
    await new Promise((res) => setTimeout(res, intervalMs));
  }

  // final attempt with forced refresh from Firebase (in case cached token is stale)
  try {
    if (auth && auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken(true); // force refresh
      if (idToken) {
        try { localStorage.setItem("auth_token", idToken); } catch (e) {}
        try { sessionStorage.setItem("auth_token", idToken); } catch (e) {}
        return idToken;
      }
    }
  } catch (err) {
    // ignore
  }

  // nothing found within timeout
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
  const [selected, setSelected] = useState([]); // store selected project IDs

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE}/api/projects`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Server ${res.status} ${txt}`);
      }
      const data = await res.json();
      const list = (data.items || []).map((p) => ({
        ...p,
        gallery: safeParse(p.gallery),
      }));
      setItems(list);
      setSelected([]); // clear selections on reload
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
      const res = await fetch(`${BACKEND_BASE}/api/projects/${id}`, {
        method: "DELETE",
        headers,
      });
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

      // If your backend supports batch delete endpoint, replace the loop with a single request.
      for (const id of ids) {
        const res = await fetch(`${BACKEND_BASE}/api/projects/${id}`, {
          method: "DELETE",
          headers,
        });
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
    showDeleteConfirm({
      title: `Delete ${selected.length} selected project${selected.length > 1 ? "s" : ""}?`,
      message: "This will permanently delete all selected projects.",
      onConfirm: () => performBulkDelete(selected),
    });
  };

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selected.length === items.length) {
      setSelected([]); // deselect all
    } else {
      setSelected(items.map((i) => i.id)); // select all
    }
  };

  return (
    <div className="admin-projects">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Projects</h2>
        <div className="buttons" style={{ display: "flex", gap: 10 }}>
          <Link to="/admin/projects/new" className="btn">Add Project</Link>
          <Link to="/admin/import" className="btn">Bulk Import</Link>

          {/* 🔴 Bulk Delete button */}
          <button
            onClick={removeSelected}
            className="btn"
            style={{
              background: selected.length > 0 ? "#dc2626" : "#aaa",
              color: "#fff",
              fontWeight: 700,
              cursor: selected.length > 0 ? "pointer" : "not-allowed",
            }}
            disabled={selected.length === 0}
          >
            Delete Selected
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 20 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 20, color: "#666" }}>
          No projects found.
          <div style={{ marginTop: 12 }}>
            <button onClick={load} className="btn">Reload</button>
          </div>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selected.length === items.length && items.length > 0}
                  onChange={selectAll}
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
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() => toggleSelect(r.id)}
                  />
                </td>
                <td>{r.title}</td>
                <td>{r.city}</td>
                <td>{r.slug}</td>
                <td className="function">
                  <Link className="edit" to={`/admin/projects/${r.id}`}>Edit</Link>{" | "}
                  <button className="delete" onClick={() => remove(r.id, r.title)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
