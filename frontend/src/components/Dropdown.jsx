// src/components/Dropdown.jsx
import React, { useState, useRef, useEffect } from "react";
import "../assets/pages/Project.css"; // ensure the styles are present

/**
 * Dropdown supporting single-select (default) and multi-select mode.
 *
 * Props:
 * - value: string (single mode) OR array of strings (multi mode)
 * - onChange: (value) => void
 *    - single mode: called with string (or "" to clear)
 *    - multi mode: called with array of strings (empty array to clear)
 * - options: array of { value, label } OR array of strings
 * - placeholder: string shown when nothing selected (single mode) or when none in multi
 * - id: optional id for accessibility
 * - className: additional wrapper class
 * - includeAll: boolean - show an "All" option which clears selection
 * - allLabel: label for All (default: "All")
 * - multiple: boolean - when true enable multi-select behavior
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

  // Normalize options -> [{value, label}]
  const normalized = Array.isArray(options)
    ? options.map((opt) => {
        if (opt && typeof opt === "object") return { value: String(opt.value), label: String(opt.label ?? opt.value) };
        return { value: String(opt), label: String(opt) };
      })
    : [];

  // Normalize incoming value(s)
  const selectedValues = multiple
    ? Array.isArray(value)
      ? value.map(String)
      : []
    : value === null || value === undefined
    ? ""
    : String(value);

  // Helpers
  const isSelected = (val) =>
    multiple ? selectedValues.includes(String(val)) : String(val) === String(selectedValues);

  // Display label
  let label;
  if (multiple) {
    if (!selectedValues || selectedValues.length === 0) label = placeholder || "Select";
    else if (selectedValues.length === 1) {
      const found = normalized.find((o) => o.value === selectedValues[0]);
      label = found ? found.label : selectedValues[0];
    } else {
      // Show count + first label as concise default
      const first = normalized.find((o) => o.value === selectedValues[0]);
      label = `${selectedValues.length} selected${first ? ` — ${first.label}` : ""}`;
    }
  } else {
    const sel = normalized.find((o) => o.value === selectedValues) || null;
    label = sel ? sel.label : (placeholder || "Select");
  }

  // Close on outside click/Escape
  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Keyboard navigation when open
  useEffect(() => {
    if (!open || !listRef.current) return;
    const items = Array.from(listRef.current.querySelectorAll("[role='option']"));
    let idx = items.findIndex((it) => it.getAttribute("data-value") === String(selectedValues?.[0] ?? selectedValues));
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
        const v = document.activeElement?.getAttribute("data-value");
        if (v !== null && v !== undefined) {
          if (v === "__empty__") {
            // clear selection
            if (multiple) onChange([]);
            else onChange("");
            if (!multiple) setOpen(false);
          } else if (multiple) {
            toggleValue(v);
            // keep open in multi mode
          } else {
            onChange(v);
            setOpen(false);
          }
        }
        e.preventDefault();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }

    const el = listRef.current;
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedValues]);

  // Toggle logic for multi mode
  function toggleValue(v) {
    const s = selectedValues.slice(); // copy
    const idx = s.indexOf(String(v));
    if (idx >= 0) {
      s.splice(idx, 1); // remove
    } else {
      s.push(String(v));
    }
    onChange(s);
  }

  // Click handler for options
  function pick(v) {
    if (v === "__empty__") {
      if (multiple) onChange([]);
      else onChange("");
      setOpen(false);
      return;
    }

    if (multiple) {
      toggleValue(v);
      // remain open in multi mode for additional selections
    } else {
      onChange(v);
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`dropdown-wrap ${className}`}
      style={{ position: "relative" }}
    >
      <button
        type="button"
        id={id}
        className="dropdown-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setTimeout(() => listRef.current?.querySelector("[role='option']")?.focus(), 0);
          }
        }}
      >
        <span className={`dropdown-label ${(!selectedValues || (multiple ? selectedValues.length === 0 : selectedValues === "")) ? "muted" : ""}`}>
          {label}
        </span>
        <span className="dropdown-arrow" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <ul

          ref={listRef}
          role="listbox"
          aria-labelledby={id}
          aria-multiselectable={multiple ? "true" : undefined}
          className="dropdown-list"
          tabIndex={-1}
        >
          {includeAll && (
            <li
              role="option"
              tabIndex={0}
              data-value="__empty__"
              className={`dropdown-item ${multiple ? (selectedValues.length === 0 ? "selected" : "") : (String(selectedValues) === "" ? "selected" : "")}`}
              onClick={() => pick("__empty__")}
              onKeyDown={(e) => {
                if (e.key === "Enter") pick("__empty__");
              }}
            >
              <div className="dropdown-item-label muted">{allLabel}</div>
            </li>
          )}

          {normalized.map((opt) => (
            <li
              key={opt.value}
              role="option"
              tabIndex={0}
              data-value={opt.value}
              aria-selected={isSelected(opt.value)}
              className={`dropdown-item ${isSelected(opt.value) ? "selected" : ""}`}
              onClick={() => pick(opt.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") pick(opt.value);
              }}
            >
              <div className="dropdown-item-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span >{opt.label}</span>
                {multiple && (
                  <input 
                    type="checkbox"
                    readOnly
                    tabIndex={-1}
                    checked={isSelected(opt.value)}
                    aria-hidden
                  />
                )}
                
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
