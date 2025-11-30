// src/pages/admin/ProjectOtherDetailsSection.jsx
import React, { useState } from "react";
import styles from "../../assets/pages/admin/ProjectForm.module.css";

export default function ProjectOtherDetailsSection({
  form,
  setField,
  brochureFileRef,
  uploadBrochureFile,
  docFileRef,
  docUploading,
  uploadOtherDocument,
  deleteOtherDocument,
  confirmRenameOtherDocument,
  openDocPreview,
}) {
  const [draftNames, setDraftNames] = useState({});

  const handleNameChange = (doc, idx, value) => {
    const key = doc.path || doc.id || String(idx);
    setDraftNames((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirmRenameClick = (doc, idx) => {
    const key = doc.path || doc.id || String(idx);
    const newName = draftNames[key] ?? doc.name ?? "";
    confirmRenameOtherDocument(doc, newName, idx, () => {
      setDraftNames((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    });
  };

  return (
    <section className={styles.grid2}>
      <label className={styles.formLabel}>
        Blocks
        <input
          className={styles.input}
          value={form.blocks}
          onChange={(e) => setField("blocks", e.target.value)}
          placeholder="e.g. A, B, C or 2"
        />
      </label>

      <label className={styles.formLabel}>
        Units
        <input
          className={styles.input}
          value={form.units}
          onChange={(e) => setField("units", e.target.value)}
          placeholder="Total units (number)"
        />
      </label>

      <label className={styles.formLabel}>
        Floors
        <input
          className={styles.input}
          value={form.floors}
          onChange={(e) => setField("floors", e.target.value)}
          placeholder="Number of floors"
        />
      </label>

      <label className={styles.formLabel}>
        Land Area
        <input
          className={styles.input}
          value={form.land_area}
          onChange={(e) => setField("land_area", e.target.value)}
          placeholder="What is the land_area"
        />
      </label>

      {/* Brochure */}
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
              await uploadBrochureFile(file);
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
          <input
            ref={docFileRef}
            type="file"
            accept=".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await uploadOtherDocument(file);
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
                    <button
                      type="button"
                      onClick={() => openDocPreview(doc)}
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

                    <input
                      className={styles.input}
                      style={{ flex: "1 1 auto" }}
                      value={draftName}
                      onChange={(e) =>
                        handleNameChange(doc, idx, e.target.value)
                      }
                      placeholder={doc.original_name || "Document name"}
                    />

                    {isDirty && (
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => handleConfirmRenameClick(doc, idx)}
                      >
                        Confirm rename
                      </button>
                    )}

                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => deleteOtherDocument(idx, doc)}
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

      <label className={styles.formLabel}>
        Contact phone
        <input
          className={styles.input}
          value={form.contact_phone}
          onChange={(e) => setField("contact_phone", e.target.value)}
          placeholder="+91..."
        />
      </label>

      <label className={styles.formLabel}>
        Contact email
        <input
          className={styles.input}
          type="email"
          value={form.contact_email}
          onChange={(e) => setField("contact_email", e.target.value)}
          placeholder="sales@example.com"
        />
      </label>
    </section>
  );
}
