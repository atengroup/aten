// src/components/OptionGroup.jsx
import React from "react";
import styles from "../assets/pages/HomeEnquiry.module.css";

/**
 * Props:
 * - title: string
 * - options: array of { id, label, image, bullets: [string, string] }
 * - multi: boolean (true => multi-select, false => single-select)
 * - selected: array (for multi) or string (for single)
 * - onChange: fn(newSelected) -> updates parent
 */
export default function OptionGroup({ title, options = [], multi = false, selected, onChange }) {
  const isSelected = (id) => {
    if (multi) return Array.isArray(selected) && selected.includes(id);
    return selected === id;
  };

  function toggle(id) {
    if (multi) {
      const cur = Array.isArray(selected) ? [...selected] : [];
      const idx = cur.indexOf(id);
      if (idx === -1) cur.push(id);
      else cur.splice(idx, 1);
      onChange && onChange(cur);
    } else {
      const next = isSelected(id) ? null : id;
      onChange && onChange(next);
    }
  }

  function removeChip(id) {
    if (!multi) return onChange && onChange(null);
    const cur = Array.isArray(selected) ? selected.filter((s) => s !== id) : [];
    onChange && onChange(cur);
  }

  return (
    <div className={styles.optionGroupCard || ""}>
      <div className={styles.optionGroupHeader || ""} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h4 style={{ margin: 0 }}>{title}</h4>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* render pills */}
          {multi
            ? (Array.isArray(selected) ? selected : []).map((sid) => {
                const opt = options.find((o) => o.id === sid);
                return (
                  <span key={sid} className={styles.chip}>
                    {opt ? opt.label : sid}
                    <button type="button" className={styles.chipRemove} onClick={() => removeChip(sid)}>×</button>
                  </span>
                );
              })
            : selected && (() => {
                const opt = options.find((o) => o.id === selected);
                return opt ? (
                  <span className={styles.chip} key={opt.id}>
                    {opt.label}
                    <button type="button" className={styles.chipRemove} onClick={() => removeChip(opt.id)}>×</button>
                  </span>
                ) : null;
              })()}
        </div>
      </div>

      <div className={styles.optionList}>
        {options.map((opt) => {
          const sel = isSelected(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              className={`${styles.optionCard} ${sel ? styles.optionCardSelected : ""}`}
              onClick={() => toggle(opt.id)}
            >
              <div className={styles.optionThumb}>
                <img src={opt.image || `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%' height='100%' fill='%23f3f4f6'/></svg>`} alt={opt.label} />
              </div>

              <div className={styles.optionBody}>
                <div className={styles.optionTitle}>{opt.label}</div>
                <ul className={styles.optionBullets}>
                  {(opt.bullets || []).slice(0, 2).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
