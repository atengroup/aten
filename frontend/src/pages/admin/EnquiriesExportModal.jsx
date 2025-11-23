// src/components/EnquiriesExportModal.jsx
import React, { useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";

/**
 * EnquiriesExportModal
 *
 * Props:
 * - open (bool)           : show/hide modal
 * - onClose (func)        : close modal
 * - filteredItems (array) : the full filtered dataset (client-side)
 * - columns (array)       : ordered list of available column keys
 * - visibleCols (Set)     : Set of currently visible columns (for default checks)
 * - pageSize (number)     : current pageSize used in the table
 *
 * Produces a CSV for the requested rows/columns. If the requested range spans many rows,
 * the CSV includes all those rows in a single file. (If you want multiple files per page,
 * we can add that later.)
 */
export default function EnquiriesExportModal({
  open,
  onClose,
  filteredItems = [],
  columns = [],
  visibleCols = new Set(),
  pageSize = 10,
}) {
  
  const totalRows = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  // selected columns state
  const [selCols, setSelCols] = useState(() => new Set(visibleCols));
  // export range: either "all" or page start/end
  const [mode, setMode] = useState("range"); // "all" | "range"
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(Math.max(1, Math.ceil(totalRows / pageSize)));

  // keep toPage in bounds when pageSize or totalRows changes
  useEffect(() => {
    const tp = Math.max(1, Math.ceil(totalRows / pageSize));
    setToPage((prev) => Math.min(prev, tp));
  }, [totalRows, pageSize]);

  useEffect(() => {
    // reset default selection when modal opens
    if (open) {
      setSelCols(new Set(visibleCols));
      setMode("range");
      setFromPage(1);
      setToPage(Math.max(1, Math.ceil(totalRows / pageSize)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleCol = (col) => {
    setSelCols((s) => {
      const n = new Set(s);
      if (n.has(col)) n.delete(col);
      else n.add(col);
      return n;
    });
  };

  const allSelectedCount = selCols.size;

  // compute rows to export based on mode & page range
  const rowsToExport = useMemo(() => {
    if (!filteredItems || filteredItems.length === 0) return [];
    if (mode === "all") return filteredItems;
    // ensure valid page numbers
    const f = Math.max(1, Math.min(fromPage, totalPages));
    const t = Math.max(1, Math.min(toPage, totalPages));
    const startIdx = (Math.min(f, t) - 1) * pageSize;
    const endIdx = (Math.max(f, t)) * pageSize; // exclusive
    return filteredItems.slice(startIdx, Math.min(endIdx, filteredItems.length));
  }, [filteredItems, mode, fromPage, toPage, pageSize, totalPages]);

  function escapeVal(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function buildCSV(rows, cols) {
    const header = cols.join(",");
    const lines = rows.map((r) => cols.map((c) => escapeVal(r[c])).join(","));
    return [header, ...lines].join("\n");
  }

  function downloadCSV() {
    if (rowsToExport.length === 0) {
      alert("No rows selected for export.");
      return;
    }
    if (!selCols || selCols.size === 0) {
      alert("Select at least one column.");
      return;
    }

    const cols = columns.filter((c) => selCols.has(c));
    const csv = buildCSV(rowsToExport, cols);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filenameMode = mode === "all" ? "all" : `p${fromPage}-p${toPage}`;
    a.href = url;
    a.download = `enquiries_${filenameMode}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onClose();
  }

  if (!open) return null;

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Export Enquiries</h3>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <strong>What to export</strong>
            <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
              <label style={radioLabelStyle}>
                <input type="radio" checked={mode === "range"} onChange={() => setMode("range")} /> Export page range
              </label>
              <label style={radioLabelStyle}>
                <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} /> Export all filtered rows
              </label>
            </div>

            {mode === "range" && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#444" }}>From page</div>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={fromPage}
                    onChange={(e) => setFromPage(Number(e.target.value || 1))}
                    style={{ width: 88, padding: "6px 8px" }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#444" }}>To page</div>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={toPage}
                    onChange={(e) => setToPage(Number(e.target.value || 1))}
                    style={{ width: 88, padding: "6px 8px" }}
                  />
                </div>

                <div style={{ marginLeft: 8, fontSize: 13, color: "#333" }}>
                  ({rowsToExport.length} rows will be exported)
                </div>
              </div>
            )}

            {mode === "all" && (
              <div style={{ marginTop: 8, fontSize: 13, color: "#333" }}>
                All filtered rows will be exported ({rowsToExport.length} rows).
              </div>
            )}
          </div>

          <div>
            <strong>Columns to include</strong>
            <div style={{ marginTop: 8, maxHeight: 200, overflow: "auto", border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
              <div style={{ marginBottom: 8 }}>
                <button
                  onClick={() => setSelCols(new Set(columns))}
                  className="btn-small"
                  style={{ marginRight: 8 }}
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelCols(new Set())}
                  className="btn-small"
                >
                  Clear
                </button>
                <span style={{ marginLeft: 12, color: "#666" }}>{allSelectedCount} selected</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
                {columns.map((c) => (
                  <label key={c} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={selCols.has(c)} onChange={() => toggleCol(c)} />
                    <span style={{ fontSize: 13 }}>{c}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={downloadCSV}>
              Download CSV ({rowsToExport.length} rows)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// simple inline styles (move to CSS if you want)
const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const modalStyle = {
  width: "min(900px, 96%)",
  maxHeight: "86vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};

const radioLabelStyle = { display: "inline-flex", gap: 8, alignItems: "center", marginRight: 12 };

EnquiriesExportModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  filteredItems: PropTypes.array,
  columns: PropTypes.array,
  visibleCols: PropTypes.instanceOf(Set),
  pageSize: PropTypes.number,
};
