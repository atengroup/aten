// src/components/ConfirmDeleteToast.jsx
import React from "react";
import toast from "react-hot-toast";

/**
 * showDeleteConfirm(options)
 *
 * - title: string
 * - message: string
 * - onConfirm: function (can be async). will be awaited.
 * - duration: ms or Infinity (default Infinity so toast only goes away when user acts)
 *
 * Returns the toast id.
 */
export default function showDeleteConfirm({
  title = "Delete Item?",
  message = "This action cannot be undone.",
  onConfirm,
  duration = Infinity, // keep until user acts
}) {
  // create the toast and capture returned id
  const toastId = toast.custom(
    (t) => {
      // helper to reliably dismiss this toast
      const dismissNow = () => {
        try {
          // dismiss by the render-provided id (preferred)
          if (t?.id) toast.dismiss(t.id);
        } catch (e) {
          // ignore
        }
        try {
          // also dismiss by the outer id returned by toast.custom as a fallback
          if (toastId) toast.dismiss(toastId);
        } catch (e) {}
      };

      // click handlers
      const handleCancel = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        dismissNow();
      };

      const handleDelete = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        // dismiss first to give immediate feedback
        dismissNow();

        // call onConfirm if provided; await if it's async
        if (typeof onConfirm === "function") {
          try {
            await onConfirm();
          } catch (err) {
            // if confirm handler fails, show an error toast and rethrow to console
            console.error("onConfirm error:", err);
            toast.error("Action failed");
          }
        }
      };

      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            background: "#F2E8E4",
            color: "#0f1720",
            padding: 14,
            borderRadius: 10,
            boxShadow: "0 8px 28px rgba(12,18,20,0.12)",
            border: "1px solid rgba(12,18,20,0.04)",
            width: 320,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            fontFamily:
              "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
            <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>{message}</div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 6,
            }}
          >
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(12,18,20,0.06)",
                background: "transparent",
                color: "#333",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDelete}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: "#dc2626",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      );
    },
    { duration } // keep until dismissed
  );

  // return the id so caller may dismiss programmatically if needed
  return toastId;
}
