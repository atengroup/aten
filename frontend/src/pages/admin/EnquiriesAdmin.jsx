// src/pages/admin/EnquiriesAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import Dropdown from "../../components/Dropdown";
import "../../assets/pages/admin/EnquiriesAdmin.css";
import toast from "react-hot-toast";
import EnquiriesExportModal from "./EnquiriesExportModal";
import { auth } from "../../firebaseConfig";
import showDeleteConfirm from "../../components/ConfirmDeleteToast";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");


const DEFAULT_VISIBLE_COLS = [
  "enquiry_id",
  "user_id",
  "name",
  "user_phone",
  "email",
  "city",
  "created_at",
  "type",
  "area",
];

const normalizeRow = (it, tableName) => {
  const o = {
    ...it,
    enquiry_id: it.enquiry_id ?? it.id ?? null,
    user_id: it.user_id ?? it.userId ?? null,
    name: it.name ?? it.user_name ?? it.customer_name ?? "",
    user_phone: it.user_phone ?? it.phone ?? it.contact_phone ?? "",
    email: it.email ?? it.email_address ?? "",
    table: it.table ?? it._table ?? tableName,
  };
  if (o._table !== undefined) delete o._table;
  return o;
};

function normalizePhone(p) {
  if (!p) return "";
  return String(p).replace(/\D/g, "");
}

function toCSV(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = columns.join(",");
  const lines = rows.map((r) => columns.map((c) => esc(r[c])).join(","));
  return [header, ...lines].join("\n");
}

export default function EnquiriesAdmin() {
  // page/data
  const [table, setTable] = useState("home");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);

  // filters/pagination/search/columns
  const [cityFilter, setCityFilter] = useState("");
  const [bhkFilter, setBhkFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchCol, setSearchCol] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [visibleCols, setVisibleCols] = useState([]);

  // UI state
  const [expandedKey, setExpandedKey] = useState(null);
  const [relatedMap, setRelatedMap] = useState({});
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editBody, setEditBody] = useState({});

  // --- Helpers for auth headers (handles race conditions) ---
  // safe polling-getAuthToken: polls storages + Firebase until token or timeout
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
      // console.warn("getAuthToken: firebase attempt failed", err);
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
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }
  // --- end helpers ---

  // derive columns and search options
  const columns = useMemo(() => {
    const setKeys = new Set();
    for (const r of items) Object.keys(r || {}).forEach((k) => setKeys.add(k));
    if (setKeys.has("_table") && setKeys.has("table")) setKeys.delete("_table");
    const preferred = [
      "enquiry_id",
      "user_id",
      "name",
      "user_phone",
      "email",
      "city",
      "created_at",
      "table",
    ];
    const rest = Array.from(setKeys).filter((k) => !preferred.includes(k));
    return [...preferred.filter((p) => setKeys.has(p)), ...rest];
  }, [items]);

  const availableCities = useMemo(() => Array.from(new Set(items.map((i) => i.city).filter(Boolean))).sort(), [items]);
  const availableTypes = useMemo(() => Array.from(new Set(items.map((i) => i.type).filter(Boolean))).sort(), [items]);
  const availableSearchCols = useMemo(() => columns.slice(), [columns]);

  // visibleCols default (9) and keep in sync
  useEffect(() => {
    if (columns.length && visibleCols.length === 0) {
      const inter = DEFAULT_VISIBLE_COLS.filter((c) => columns.includes(c));
      setVisibleCols(inter.length ? inter : columns.slice(0, 9));
    } else {
      setVisibleCols((prev) => prev.filter((c) => columns.includes(c)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length]);

  // load data
  useEffect(() => {
    setCityFilter("");
    setBhkFilter("");
    setTypeFilter("");
    setSearchCol("");
    setSearchValue("");
    setPage(1);
    setExpandedKey(null);
    setRelatedMap({});
    setLoading(true);

    let mounted = true;
    (async () => {
      try {
        const headers = await makeHeaders();

        const res = await fetch(`${BACKEND_BASE}/api/enquiries?table=${encodeURIComponent(table)}`, {
          method: "GET",
          headers,
          credentials: "include",
        });

        if (!mounted) return;
        if (!res.ok) {
          toast.error("Failed to load enquiries");
          setItems([]);
          return;
        }
        const j = await res.json();
        const arr = j.items || [];
        setItems(arr.map((it) => normalizeRow(it, table)));
      } catch (err) {
        console.error("fetch error", err);
        toast.error("Failed to load enquiries");
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => (mounted = false);
  }, [table, refreshToken]);

  // derived lists, filtering & paging
  const filteredItems = useMemo(() => {
    const q = String(searchValue || "").toLowerCase().trim();
    return (items || []).filter((it) => {
      if (cityFilter && String((it.city || "")).toLowerCase() !== String(cityFilter).toLowerCase()) return false;
      if (typeFilter) {
        if (!it.type || String(it.type).toLowerCase() !== String(typeFilter).toLowerCase()) return false;
      }
      if (searchCol && q) {
        const raw = it[searchCol];
        if (raw === null || raw === undefined) return false;
        if (!String(raw).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, cityFilter, bhkFilter, typeFilter, searchCol, searchValue, table]);

  const totalRows = filteredItems.length;
  const totalPagesComputed = Math.max(1, Math.ceil(totalRows / pageSize));
  useEffect(() => {
    if (page > totalPagesComputed) setPage(totalPagesComputed);
  }, [page, totalPagesComputed]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // handlers
  const refresh = () => setRefreshToken((t) => t + 1);

  const exportCSV = () => {
    if (!filteredItems.length) return toast.error("No rows to export");
    const cols = visibleCols.length ? visibleCols : columns;
    const csv = toCSV(filteredItems, cols);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table}_enquiries_export.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleNameClick = async (row) => {
    const personKey = row.user_id
      ? `uid:${row.user_id}`
      : row.user_phone
      ? `phone:${normalizePhone(row.user_phone)}`
      : row.email
      ? `email:${row.email.toLowerCase()}`
      : null;
    if (!personKey) return;
    if (expandedKey === personKey) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(personKey);
    if (relatedMap[personKey]) return;

    setLoadingRelated(true);
    try {
      let qs = "";
      if (row.user_id) qs = `user_id=${encodeURIComponent(row.user_id)}`;
      else if (row.user_phone) qs = `phone=${encodeURIComponent(row.user_phone)}`;
      else if (row.email) qs = `email=${encodeURIComponent(row.email)}`;

      const headers = await makeHeaders();

      const res = await fetch(`${BACKEND_BASE}/api/enquiries/related?${qs}`, {
        method: "GET",
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        toast.error("Failed to load related enquiries");
        setRelatedMap((m) => ({ ...m, [personKey]: [] }));
      } else {
        const j = await res.json();
        const arr = j.items || [];
        setRelatedMap((m) => ({ ...m, [personKey]: arr.map((it) => normalizeRow(it, it.table ?? table)) }));
      }
    } catch (err) {
      console.error("related fetch err", err);
      setRelatedMap((m) => ({ ...m, [personKey]: [] }));
    } finally {
      setLoadingRelated(false);
    }
  };

  const openEdit = (row) => {
    setEditingRow(row);
    const body = { ...row };
    delete body.enquiry_id;
    setEditBody(body);
  };
  const closeEdit = () => {
    setEditingRow(null);
    setEditBody({});
  };

  const submitEdit = async () => {
    if (!editingRow) return;
    try {
      const id = editingRow.enquiry_id;
      const tbl = editingRow.table;
      const payload = { ...editBody };
      delete payload.table;
      delete payload.enquiry_id;

      const headers = await makeHeaders();

      const res = await fetch(`${BACKEND_BASE}/api/enquiries/${encodeURIComponent(tbl)}/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error("Update failed: " + (err.error || res.status));
      } else {
        toast.success("Enquiry updated");
        refresh();
        closeEdit();
      }
    } catch (err) {
      console.error("update err", err);
      toast.error("Update error");
    }
  };

  const deleteRow = async (row) => {
  showDeleteConfirm({
    title: "Delete Enquiry?",
    message: `Delete enquiry #${row.enquiry_id} from "${row.table}"? This cannot be undone.`,
    onConfirm: async () => {
      try {
        const headers = await makeHeaders();

        const res = await fetch(
          `${BACKEND_BASE}/api/enquiries/${encodeURIComponent(
            row.table
          )}/${encodeURIComponent(row.enquiry_id)}`,
          {
            method: "DELETE",
            headers,
            credentials: "include",
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error("Delete failed: " + (err.error || res.status));
        } else {
          toast.success("Deleted");
          refresh();
        }
      } catch (err) {
        console.error("delete err", err);
        toast.error("Delete error");
      }
    },
  });
};


  const renderCellVal = (row, key) => {
    const v = row[key];
    if (key === "created_at" && v) {
      try {
        return new Date(v).toLocaleString();
      } catch {
        return v;
      }
    }
    if (key === "email" && v) {
      const href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(v)}`;
      return (
        <a href={href} target="_blank" rel="noreferrer">
          {v}
        </a>
      );
    }
    return v === null || v === undefined || v === "" ? "—" : String(v);
  };

  // pagination helpers
  const goToPage = (n) => {
    const pn = Math.max(1, Math.min(totalPagesComputed, n));
    setPage(pn);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderPageNumbers = () => {
    const maxButtons = 7;
    const pages = [];
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = Math.min(totalPagesComputed, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1);
    for (let p = start; p <= end; p++) pages.push(p);
    return pages.map((p) => (
      <button key={p} onClick={() => goToPage(p)} className={`btn-small ${p === page ? "active-page" : ""}`} aria-current={p === page ? "page" : undefined} style={{ marginRight: 6 }}>
        {p}
      </button>
    ));
  };

  // small inner components to keep JSX tidy
  const TableToggle = () => {
    const btn = (key, label) => (
      <button key={key} className={`btn table-toggle-btn ${table === key ? "active-table" : ""}`} onClick={() => setTable(key)} aria-pressed={table === key}>
        {label}
      </button>
    );
    return (
      <div style={{ display: "flex", flexWrap:"wrap", gap: 5, alignItems: "center" }}>
        {btn("home", "Home")}
        {btn("custom", "Custom")}
        {btn("kb", "Kitchen / Bathroom")}
        {btn("wardrobe", "Wardrobe")}
      </div>
    );
  };

  return (
    <div className="enquiries-admin-page">
      <div className="controls-row">
        <div className="left-controls" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label className="control-label">Viewing</label>
            <TableToggle />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 12, color: "#333", fontWeight: 700, marginBottom: 6 }}>City</div>
              <Dropdown id="city-filter" value={cityFilter} onChange={(v) => { setCityFilter(v); setPage(1); }} options={[{ value: "", label: "All cities" }, ...availableCities.map((c) => ({ value: c, label: c }))]} placeholder="All cities" includeAll={false} />
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 12, color: "#333", fontWeight: 700, marginBottom: 6 }}>Type</div>
              <Dropdown id="type-filter" value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={[{ value: "", label: "All types" }, ...availableTypes.map((t) => ({ value: t, label: t }))]} placeholder="All types" includeAll={false} />
            </div>

            <div style={{ background: "#BFADA3", padding: "10px", borderRadius: "8px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 160 }}>
                  <div style={{ fontSize: 12, color: "#333", fontWeight: 700, marginBottom: 6 }}>Search by</div>
                  <Dropdown id="search-col" value={searchCol} onChange={(v) => { setSearchCol(v); setPage(1); }} options={[{ value: "", label: "Any column" }, ...availableSearchCols.map((c) => ({ value: c, label: c }))]} placeholder="Choose column" includeAll={false} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", minWidth: 220 }}>
                  <div style={{ fontSize: 12, color: "#333", fontWeight: 700, marginBottom: 6 }}>Value</div>
                  <input value={searchValue} onChange={(e) => { setSearchValue(e.target.value); setPage(1); }} placeholder="Type to search..." style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,30,0.06)", background: "#fff", outline: "none", minWidth: 220 }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columns + Page size */}
        <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <label style={{ fontWeight: 700, marginRight: 8 }}>Columns</label>
            <div style={{ display: "inline-block", zIndex: "0", minWidth: 260 }}>
              <Dropdown id="cols-dropdown" value={visibleCols} onChange={(vals) => setVisibleCols(Array.isArray(vals) ? vals : [])} options={columns.map((c) => ({ value: c, label: c }))} placeholder="Select columns" multiple={true} includeAll={false} />
            </div>
          </div>
        </div>

        <div className="right-controls" style={{ alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn refresh" onClick={refresh}>Refresh</button>
            <button className="btn" onClick={() => setShowExportModal(true)} style={{ marginLeft: 8 }}>Export CSV</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        {loading ? (
          <div className="loading">Loading enquiries…</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty">No enquiries found.</div>
        ) : (
          <>
            <table className="enquiries-table">
              <thead>
                <tr>
                  {(visibleCols.length ? visibleCols : columns).map((c) => <th key={c}>{c}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {pageItems.map((row) => {
                  const personKey = row.user_id ? `uid:${row.user_id}` : row.user_phone ? `phone:${normalizePhone(row.user_phone)}` : row.email ? `email:${(row.email || "").toLowerCase()}` : `r:${row.enquiry_id || Math.random()}`;
                  const isExpanded = expandedKey === personKey;
                  const shownCols = visibleCols.length ? visibleCols : columns;

                  return (
                    <React.Fragment key={`${row.table}-${row.enquiry_id || Math.random()}`}>
                      <tr className={`row-main ${isExpanded ? "expanded" : ""}`}>
                        {shownCols.map((c) => (
                          <td key={c} className={c === "name" ? "name-cell" : ""}>
                            {c === "name" ? <button className="name-btn" onClick={() => handleNameClick(row)}>{row.name || "—"}</button> : renderCellVal(row, c)}
                          </td>
                        ))}
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn-small" onClick={() => openEdit(row)}>Edit</button>
                            <button className="btn-small" onClick={() => deleteRow(row)}>Delete</button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="row-expanded">
                          <td colSpan={Math.max(1, shownCols.length + 1)}>
                            <div className="expanded-panel">
                              <div className="expanded-header">
                                <strong>Other enquiries for {row.name || row.user_phone || row.email}</strong>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button className="btn-small" onClick={() => { setRelatedMap((m) => ({ ...m, [personKey]: undefined })); handleNameClick(row); }}>Refresh</button>
                                </div>
                              </div>

                              {loadingRelated && !relatedMap[personKey] ? (
                                <div>Loading…</div>
                              ) : (
                                <div className="related-list">
                                  {(relatedMap[personKey] || []).length === 0 ? (
                                    <div className="none">No other enquiries found for this person.</div>
                                  ) : (
                                    <table className="related-table">
                                      <thead>
                                        <tr><th>Source</th><th>Created</th><th>City</th><th>Contact</th><th>Details</th></tr>
                                      </thead>
                                      <tbody>
                                        {(relatedMap[personKey] || []).map((it) => (
                                          <tr key={`${it.table}-${it.enquiry_id || Math.random()}`}>
                                            <td style={{ textTransform: "capitalize" }}>{it.table}</td>
                                            <td>{it.created_at ? new Date(it.created_at).toLocaleString() : "—"}</td>
                                            <td>{it.city || "—"}</td>
                                            <td>{it.name || "—"} <br /> {it.user_phone || it.phone || "—"} <br /> {it.email || ""}</td>
                                            <td>{[it.type, it.material, it.area, it.kitchen_type, it.kitchen_theme, it.bathroom_type, it.message].filter(Boolean).join(" • ")}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="btn-small" onClick={() => goToPage(1)} disabled={page === 1}>« First</button>
                <button className="btn-small" onClick={() => goToPage(page - 1)} disabled={page === 1}>‹ Prev</button>
                {renderPageNumbers()}
                <button className="btn-small" onClick={() => goToPage(page + 1)} disabled={page === totalPagesComputed}>Next ›</button>
                <button className="btn-small" onClick={() => goToPage(totalPagesComputed)} disabled={page === totalPagesComputed}>Last »</button>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
               <div style={{ fontSize: 13, color: "#333", fontWeight: 700 }}>Rows: {totalRows} | Page: {page}/{totalPagesComputed}</div>

                <Dropdown id="page-size" value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(1); }} options={[{ value: "10", label: "10 / page" }, { value: "25", label: "25 / page" }, { value: "50", label: "50 / page" }]} placeholder="Page size" includeAll={false} />
              </div>
              <div style={{ fontSize: 13, color: "#333" }}>Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalRows)} of {totalRows}</div>
            </div>
          </>
        )}
      </div>

      {showExportModal && <EnquiriesExportModal open={showExportModal} onClose={() => setShowExportModal(false)} filteredItems={filteredItems} columns={columns} visibleCols={visibleCols} pageSize={pageSize} />}

      {/* Edit modal */}
      {editingRow && (
        <div className="modal-backdrop" onClick={closeEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Enquiry</h3>
            <div style={{ display: "grid", gap: 8, maxHeight: "60vh", overflow: "auto" }}>
              {Object.keys(editBody).map((k) => {
                if (k === "table" || k === "enquiry_id") return null;
                const val = editBody[k];
                const isTextArea = typeof val === "string" && val.length > 120;
                return (
                  <label style={{ display: "block" }} key={k}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{k}</div>
                    {isTextArea ? <textarea value={editBody[k] || ""} onChange={(e) => setEditBody((s) => ({ ...s, [k]: e.target.value }))} /> : <input value={editBody[k] ?? ""} onChange={(e) => setEditBody((s) => ({ ...s, [k]: e.target.value }))} />}
                  </label>
                );
              })}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={closeEdit}>Cancel</button>
              <button className="btn primary" onClick={submitEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
