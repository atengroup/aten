// src/pages/admin/AddAdmin.jsx
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { auth } from "../../firebaseConfig";
import "../../assets/pages/admin/AddAdmin.css";
import showDeleteConfirm from "../../components/ConfirmDeleteToast"; // ⬅️ IMPORTED SAME CONFIRM BOX

/* ------------------------------
   Auth Token Helpers
------------------------------ */
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
      if (auth?.currentUser) {
        const idToken = await auth.currentUser.getIdToken(false);
        if (idToken) {
          try { localStorage.setItem("auth_token", idToken); } catch {}
          try { sessionStorage.setItem("auth_token", idToken); } catch {}
          return idToken;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  try {
    if (auth?.currentUser) {
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

async function makeHeaders() {
  const token = await getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/* ------------------------------
   Constants
------------------------------ */
const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

/* ------------------------------
   AddAdmin Component
------------------------------ */
export default function AddAdmin() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadAdmins() {
    setLoading(true);
    try {
      const headers = await makeHeaders();
      const res = await fetch(`${BACKEND_BASE}/api/admins`, { headers });
      if (!res.ok) throw new Error(`Failed to load admins`);
      const data = await res.json();
      setAdmins(data.items || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load admins");
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }

  function normalizePhone(phone) {
    if (!phone) return "";
    const s = String(phone).trim();
    const hasPlus = s.startsWith("+");
    const digits = s.replace(/\D/g, "");
    return hasPlus ? `+${digits}` : digits;
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!phone) return toast.error("Phone number required");

    setAdding(true);
    try {
      const headers = await makeHeaders({ forJson: true });
      const payload = { phone: normalizePhone(phone), name: name || null };
      const res = await fetch(`${BACKEND_BASE}/api/admins`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Server error");
      }

      toast.success("Admin added successfully");
      setPhone("");
      setName("");
      loadAdmins();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add admin");
    } finally {
      setAdding(false);
    }
  }

  /* -------------------------------------------------------------------
     🔄 REPLACE window.confirm() WITH SAME POPUP USED IN ProjectsAdmin
  ------------------------------------------------------------------- */
  function deleteAdmin(id, adminName) {
    showDeleteConfirm({
      title: `Delete admin "${adminName || ""}"?`,
      message: "This admin will be permanently removed.",
      onConfirm: () => performDelete(id),
    });
  }

  async function performDelete(id) {
    try {
      const headers = await makeHeaders();
      const res = await fetch(`${BACKEND_BASE}/api/admins/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) throw new Error("Delete failed");
      toast.success("Admin removed");
      loadAdmins();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete admin");
    }
  }

  /* ------------------------------ UI ------------------------------ */

  return (
    <div className="admins-admin-page">
      <header className="inline-row" style={{ justifyContent: "space-between" }}>
        <h2>Add / Manage Admins</h2>
        <button className="btn" onClick={loadAdmins} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section>
        <form onSubmit={handleAdd}>
          <div>
            <label>Phone *</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91XXXXXXXXXX"
              required
            />
          </div>

          <div>
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="inline-row">
            <button className="btn primary" type="submit" disabled={adding}>
              {adding ? "Adding…" : "Add Admin"}
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setPhone("");
                setName("");
              }}
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 20 }}>
        {loading ? (
          <p>Loading admins…</p>
        ) : admins.length === 0 ? (
          <p className="muted">No admins found.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>{a.name || "—"}</td>
                  <td>{a.phone || "—"}</td>
                  <td>
                    {a.created_at
                      ? new Date(a.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="btn small danger"
                        onClick={() => deleteAdmin(a.id, a.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
