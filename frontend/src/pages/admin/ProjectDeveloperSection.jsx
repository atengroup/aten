// src/pages/admin/ProjectDeveloperSection.jsx
import React from "react";
import styles from "../../assets/pages/admin/ProjectForm.module.css";
import Dropdown from "../../components/Dropdown";
import { getImageUrl } from "../../lib/api";

const DEV_FALLBACK_IMAGE = "/mnt/data/cd4227da-020a-4696-be50-0e519da8ac56.png";

export default function ProjectDeveloperSection({
  form,
  setField,
  developersList,
  developerSelected,
  setDeveloperSelected,
  fetchDevelopersList,
  devLogoFileRef,
  uploadFiles,
}) {
  const handleDropdownChange = (val) => {
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
  };

  return (
    <div className={styles.panels}>
      <div className={styles.panelHeader}>
        <h4>Developer Info</h4>
        <small>Pick from existing to autofill or add manually.</small>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className={styles.formLabel}>Select existing developer</label>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Dropdown
            id="developer-dropdown"
            value={developerSelected}
            onChange={handleDropdownChange}
            options={[
              ...developersList.map((d) => ({
                value: d.name,
                label: d.name,
              })),
              { value: "custom", label: "Other / Manual" },
            ]}
            placeholder="— Select developer —"
            className="developer-dropdown"
          />

          <button
            type="button"
            className={styles.btn}
            onClick={() => fetchDevelopersList()}
            title="Refresh list"
          >
            Refresh
          </button>
          <small style={{ color: "var(--muted-2)" }}>
            or choose "Other / Manual" to type new developer
          </small>
        </div>
      </div>

      <div className={styles.grid2}>
        <label className={styles.formLabel}>
          Developer Name
          <input
            className={styles.input}
            value={form.developer_name}
            onChange={(e) => {
              setField("developer_name", e.target.value);
              setDeveloperSelected("custom");
            }}
            placeholder="e.g. ABC Developers"
          />
        </label>

        <label className={styles.formLabel}>
          Developer Logo
          <div className={styles.uploaderRow}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => devLogoFileRef.current?.click()}
            >
              Upload Logo (PNG)
            </button>

            <input
              className={styles.input}
              type="text"
              value={form.developer_logo}
              onChange={(e) => {
                setField("developer_logo", e.target.value);
                setDeveloperSelected("custom");
              }}
              placeholder="or paste image URL (https://...)"
              style={{ flex: "1 1 auto", minWidth: "220px" }}
            />

            <input
              ref={devLogoFileRef}
              type="file"
              accept=".png,image/png"
              style={{ display: "none" }}
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                const [file] = files;
                const isPng =
                  file.type?.toLowerCase() === "image/png" ||
                  file.name?.toLowerCase().endsWith(".png");
                if (!isPng) {
                  // toast lives in parent; simple alert here
                  alert("Only PNG files are allowed for the developer logo.");
                  e.target.value = null;
                  return;
                }
                const uploaded = await uploadFiles([file], {
                  silent: true,
                  addToGallery: false,
                });
                if (uploaded.length) {
                  setField("developer_logo", uploaded[0]);
                }
                setDeveloperSelected("custom");
                e.target.value = null;
              }}
            />
          </div>

          {form.developer_logo && (
            <div className={styles.developerLogoPreview}>
              <img
                src={getImageUrl(form.developer_logo) || DEV_FALLBACK_IMAGE}
                alt="Developer Logo"
              />
              <button
                type="button"
                className={styles.developerLogoRemove}
                onClick={() => {
                  setField("developer_logo", "");
                  setDeveloperSelected("custom");
                }}
              >
                ×
              </button>
            </div>
          )}
        </label>
      </div>

      <label className={styles.formLabel} style={{ gridColumn: "1 / -1" }}>
        Developer Description
        <textarea
          className={styles.textarea}
          value={form.developer_description}
          onChange={(e) => {
            setField("developer_description", e.target.value);
            setDeveloperSelected("custom");
          }}
          placeholder="Short developer profile or tagline"
        />
      </label>
    </div>
  );
}
