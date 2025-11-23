import React from "react";
import "../assets/pages/HomeEnquiry.css"; // shared styles (keeps small footprint)

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
    <div className="option-group-card">
      <div className="option-group-header">
        <h4>{title}</h4>
        <div className="selected-chips">
          {/* render pills */}
          {multi
            ? (Array.isArray(selected) ? selected : []).map((sid) => {
                const opt = options.find((o) => o.id === sid);
                return (
                  <span key={sid} className="chip">
                    {opt ? opt.label : sid}
                    <button type="button" className="chip-remove" onClick={() => removeChip(sid)}>×</button>
                  </span>
                );
              })
            : selected && (() => {
                const opt = options.find((o) => o.id === selected);
                return opt ? (
                  <span className="chip" key={opt.id}>
                    {opt.label}
                    <button type="button" className="chip-remove" onClick={() => removeChip(opt.id)}>×</button>
                  </span>
                ) : null;
              })()}
        </div>
      </div>

      <div className="option-list">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={"option-card " + (isSelected(opt.id) ? "selected" : "")}
            onClick={() => toggle(opt.id)}
          >
            <div className="option-thumb">
              <img src={opt.image || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='60'><rect width='100%' height='100%' fill='%23f3f4f6'/></svg>"} alt={opt.label} />
            </div>
            <div className="option-body">
              <div className="option-title">{opt.label}</div>
              <ul className="option-bullets">
                {(opt.bullets || []).slice(0, 2).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
