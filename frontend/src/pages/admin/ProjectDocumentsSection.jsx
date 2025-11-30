// src/pages/admin/ProjectDocumentsSection.jsx
import React, { useState } from "react";
import styles from "../../assets/pages/admin/ProjectForm.module.css";

export default function ProjectDocumentsSection({
  form,
  setField,
  brochureFileRef,
  onUploadBrochure,
  docFileRef,
  docUploading,
  onUploadOtherDocument,
  onDeleteOtherDoc,
  onConfirmRename,
  onOpenPreview,
}) {
  const [draftNames, setDraftNames] = useState({});

  const handleNameChange = (doc, idx, value) => {
    const key = doc.path || doc.id || String(idx);
    setDraftNames((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirmRenameClick = (doc, idx) => {
    const key = doc.path || doc.id || String(idx);
    const newName = draftNames[key] ?? doc.name ?? "";
    onConfirmRename(doc, newName, idx, () => {
      setDraftNames((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    });
  };

  return (
    <>
      {/* Brochure field */}
      <label className={styles.formLabel}>
        Brochure
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <input
            ref={brochureFileRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await onUploadBrochure(file);
            }}
          />

          <button
            type="button"
            className={styles.btn}
            onClick={() => brochureFileRef.current?.click()}
          >
            Upload Brochure (PDF)
          </button>

          <input
            className={styles.input}
            style={{ flex: "1 1 auto" }}
            value={form.brochure_url}
            onChange={(e) => setField("brochure_url", e.target.value)}
            placeholder="or paste brochure URL (https://...)"
          />
        </div>
      </label>

      {/* Other Documents */}
      <label className={styles.formLabel}>
        Other Documents
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Hidden input for document upload */}
          <input
            ref={docFileRef}
            type="file"
            accept=".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await onUploadOtherDocument(file);
            }}
          />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => docFileRef.current?.click()}
              disabled={docUploading}
            >
              {docUploading ? "Uploading..." : "Upload Document"}
            </button>
            <small style={{ color: "var(--muted-2)" }}>
              Floor plans, payment schedules, terms, etc.
            </small>
          </div>

          {/* List of existing docs */}
          {form.other_documents && form.other_documents.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {form.other_documents.map((doc, idx) => {
                const ext = (doc.ext || "").toLowerCase();
                const isPdf =
                  ext === "pdf" || (doc.type || "").includes("pdf");
                const isImage = (doc.type || "").startsWith("image/");
                const key = doc.path || doc.id || String(idx);
                const draftName =
                  draftNames[key] ?? (doc.name || doc.original_name || "");
                const currentName = doc.name || "";
                const isDirty =
                  draftName.trim() &&
                  draftName.trim() !== (currentName || "").trim();

                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.05)",
                      background: "rgba(0,0,0,0.02)",
                    }}
                  >
                    {/* File icon button */}
                    <button
                      type="button"
                      onClick={() => onOpenPreview(doc)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#f1f5f9",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                      title={isPdf ? "Open PDF" : "Preview document"}
                    >
                      {isPdf
                        ? "PDF"
                        : isImage
                        ? "IMG"
                        : (ext || "DOC").toUpperCase().slice(0, 3)}
                    </button>

                    {/* Editable custom name */}
                    <input
                      className={styles.input}
                      style={{ flex: "1 1 auto" }}
                      value={draftName}
                      onChange={(e) =>
                        handleNameChange(doc, idx, e.target.value)
                      }
                      placeholder={doc.original_name || "Document name"}
                    />

                    {/* Confirm rename button (only if name changed) */}
                    {isDirty && (
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => handleConfirmRenameClick(doc, idx)}
                      >
                        Confirm rename
                      </button>
                    )}

                    {/* Remove */}
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => onDeleteOtherDoc(idx, doc)}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.placeholder}>
              No extra documents uploaded.
            </div>
          )}
        </div>
      </label>
    </>
  );
}
