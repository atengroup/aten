// src/pages/admin/ProjectBasicInfoSection.jsx
import React from "react";
import styles from "../../assets/pages/admin/ProjectForm.module.css";

export default function ProjectBasicInfoSection({ form, setField }) {
  return (
    <section className={styles.grid2}>
      <label className={styles.formLabel}>
        Title *
        <input
          className={styles.input}
          value={form.title}
          onChange={(e) => setField("title", e.target.value)}
          placeholder="Project title"
          required
        />
      </label>

      <label className={styles.formLabel}>
        Slug (optional)
        <input
          className={styles.input}
          value={form.slug}
          onChange={(e) => setField("slug", e.target.value)}
          placeholder="auto-generated-from-title"
        />
      </label>

      <label className={styles.formLabel}>
        City *
        <input
          className={styles.input}
          value={form.city}
          onChange={(e) => setField("city", e.target.value)}
          placeholder="e.g. Kolkata"
          required
        />
      </label>

      <label className={styles.formLabel}>
        Location area
        <input
          className={styles.input}
          value={form.location_area}
          onChange={(e) => setField("location_area", e.target.value)}
          placeholder="Joka / Salt Lake"
        />
      </label>

      <label className={styles.formLabel}>
        Address
        <textarea
          className={styles.textarea}
          value={form.address}
          onChange={(e) => setField("address", e.target.value)}
          placeholder="Full/short address"
        />
      </label>

      <label className={styles.formLabel}>
        Description
        <textarea
          className={styles.textarea}
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Full/short description"
        />
      </label>

      <label className={styles.formLabel}>
        RERA / Reg. No.
        <input
          className={styles.input}
          value={form.rera}
          onChange={(e) => setField("rera", e.target.value)}
          placeholder="WBRERA/..."
        />
      </label>

      <label className={styles.formLabel}>
        Status
        <select
          className={styles.select}
          value={form.status}
          onChange={(e) => setField("status", e.target.value)}
        >
          <option>Active</option>
          <option>Under Construction</option>
          <option>Ready To Move</option>
          <option>Completed</option>
        </select>
      </label>

      <label className={styles.formLabel}>
        Property type
        <select
          className={styles.select}
          value={form.property_type}
          onChange={(e) => setField("property_type", e.target.value)}
        >
          <option>Residential</option>
          <option>Commercial</option>
        </select>
      </label>
    </section>
  );
}
