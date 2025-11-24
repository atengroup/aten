// src/components/Dropdown.jsx
import React, { useState, useRef, useEffect } from "react";
import styles from "../assets/components/Dropdown.module.css"; // CSS MODULE

/**
 * Dropdown supporting single-select (default) and multi-select mode.
 *
 * Props:
 * - value         : string | array
 * - onChange      : function
 * - options       : array of string or {value,label}
 * - placeholder   : string
 * - id            : string
 * - className     : extra wrapper class
 * - includeAll    : boolean ("All" option)
 * - allLabel      : label for All
 * - multiple      : boolean
 */
export default function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = "",
  id,
  className = "",
  includeAll = false,
  allLabel = "All",
  multiple = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options -> [{value,label}]
  const normalized = options.map((opt) =>
    typeof opt === "object"
      ? { value: String(opt.value), label: String(opt.label ?? opt.value) }
      : { value: String(opt), label: String(opt) }
  );

  // Normalize incoming value(s)
  const selectedValues = multiple
    ? Array.isArray(value)
      ? value.map(String)
      : []
    : value === null || value === undefined
    ? ""
    : String(value);

  const isSelected = (v) =>
    multiple ? selectedValues.includes(String(v)) : selectedValues === String(v);

  // Label displayed inside button
  let label;
  if (multiple) {
    if (selectedValues.length === 0) label = placeholder || "Select";
    else if (selectedValues.length === 1) {
      const found = normalized.find((o) => o.value === selectedValues[0]);
      label = found?.label || selectedValues[0];
    } else {
      const first = normalized.find((o) => o.value === selectedValues[0]);
      label = `${selectedValues.length} selected — ${first?.label || ""}`;
    }
  } else {
    const sel = normalized.find((o) => o.value === selectedValues);
    label = sel?.label || placeholder || "Select";
  }

  /* ------------------ Outside Click + Esc Close ------------------ */
  useEffect(() => {
    function closeOnOutside(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    function closeOnEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", closeOnOutside);
    document.addEventListener("keydown", closeOnEsc);
    return () => {
      document.removeEventListener("click", closeOnOutside);
      document.removeEventListener("keydown", closeOnEsc);
    };
  }, []);

  /* ------------------ Keyboard Navigation ------------------ */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const items = Array.from(listRef.current.querySelectorAll("[role='option']"));
    let idx = items.findIndex((i) => i.getAttribute("data-value") === String(selectedValues));
    if (idx < 0) idx = 0;
    items[idx]?.focus();

    function onKey(e) {
      if (e.key === "ArrowDown") {
        idx = Math.min(items.length - 1, idx + 1);
        items[idx]?.focus();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        idx = Math.max(0, idx - 1);
        items[idx]?.focus();
        e.preventDefault();
      } else if (e.key === "Enter" || e.key === " ") {
        const v = document.activeElement?.dataset.value;
        if (!v) return;

        if (v === "__empty__") {
          multiple ? onChange([]) : onChange("");
          if (!multiple) setOpen(false);
        } else if (multiple) {
          toggleValue(v);
        } else {
          onChange(v);
          setOpen(false);
        }
        e.preventDefault();
      }
    }

    const list = listRef.current;
    list.addEventListener("keydown", onKey);
    return () => list.removeEventListener("keydown", onKey);
  }, [open, selectedValues, multiple]);

  /* ------------------ Helpers ------------------ */
  function toggleValue(v) {
    const s = [...selectedValues];
    const i = s.indexOf(String(v));
    if (i >= 0) s.splice(i, 1);
    else s.push(String(v));
    onChange(s);
  }

  function pick(v) {
    if (v === "__empty__") {
      multiple ? onChange([]) : onChange("");
      setOpen(false);
      return;
    }

    if (multiple) {
      toggleValue(v);
    } else {
      onChange(v);
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`${styles.wrap} ${className}`}>
      <button
        type="button"
        id={id}
        className={styles.btn}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`${styles.label} ${(!multiple && !value) || (multiple && selectedValues.length === 0) ? styles.muted : ""}`}>
          {label}
        </span>
        <span className={styles.arrow}>▾</span>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby={id}
          aria-multiselectable={multiple ? "true" : undefined}
          className={styles.list}
          tabIndex={-1}
        >
          {includeAll && (
            <li
              role="option"
              tabIndex={0}
              data-value="__empty__"
              onClick={() => pick("__empty__")}
              className={`${styles.item} ${(!multiple && selectedValues === "") ||
              (multiple && selectedValues.length === 0)
                ? styles.selected
                : ""}`}
            >
              <span className={`${styles.itemLabel} ${styles.muted}`}>{allLabel}</span>
            </li>
          )}

          {normalized.map((opt) => (
            <li
              key={opt.value}
              role="option"
              tabIndex={0}
              data-value={opt.value}
              aria-selected={isSelected(opt.value)}
              onClick={() => pick(opt.value)}
              className={`${styles.item} ${isSelected(opt.value) ? styles.selected : ""}`}
            >
              <span className={styles.itemLabel}>
                {opt.label}
                {multiple && (
                  <input
                    type="checkbox"
                    readOnly
                    checked={isSelected(opt.value)}
                    className={styles.check}
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
