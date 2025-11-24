// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "../assets/pages/admin/Sidebar.module.css";

export default function Sidebar() {
  const { pathname } = useLocation();

  const isActive = (path) => pathname.startsWith(path);

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarLinks}>
        <Link
          to="/admin/dashboard"
          className={`${styles.link} ${isActive("/admin/dashboard") ? styles.active : ""}`}
        >
          Dashboard
        </Link>

        <Link
          to="/admin/testimonials"
          className={`${styles.link} ${isActive("/admin/testimonials") ? styles.active : ""}`}
        >
          Testimonials
        </Link>

        <Link
          to="/admin/pricing"
          className={`${styles.link} ${isActive("/admin/pricing") ? styles.active : ""}`}
        >
          Pricing
        </Link>

        <Link
          to="/admin/properties"
          className={`${styles.link} ${isActive("/admin/properties") ? styles.active : ""}`}
        >
          Properties
        </Link>
      </div>
    </div>
  );
}
