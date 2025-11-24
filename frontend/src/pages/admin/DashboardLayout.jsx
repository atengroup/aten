// src/pages/admin/DashboardLayout.jsx
import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import styles from "../../assets/pages/admin/Dashboard.module.css";
import { useAuth } from "../../context/AuthContext";

/**
 * DashboardLayout (module-ified + theme-aware)
 */
export default function DashboardLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth?.() || {};
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("admin_sidebar_collapsed");
      setCollapsed(stored === "1");
    } catch (e) {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("admin_sidebar_collapsed", next ? "1" : "0");
      } catch (e) {}
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      if (typeof logout === "function") await logout();
    } catch (err) {
      /* ignore */
    }
    localStorage.removeItem("user");
    navigate("/login");
  };

  const activeClass = ({ isActive }) =>
    isActive ? `${styles.adminNavLink} ${styles.active}` : styles.adminNavLink;

  // uploaded logo asset (session path)
  const logoUrl = "/mnt/data/cd4227da-020a-4696-be50-0e519da8ac56.png";

  return (
    <div className={styles.dashboardContainer}>
      {/* Sidebar */}
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : styles.open}`}
        aria-expanded={!collapsed}
      >
        <div className={`${styles.sidebarTop} ${collapsed ? styles.sidebarTopCollapsed : ""}`}>
          {!collapsed ? (
            <div className={styles.sidebarBrand}>
              <div className={styles.brandRow}>
                <div>
                  <h3 className={styles.brandTitle}>Admin</h3>
                  <div className={styles.sidebarUser}>{user?.name || "Administrator"}</div>
                </div>
              </div>
            </div>
          ) : null}

          <button
            className={styles.toggleBtn}
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
          >
            {collapsed ? "❯" : "❮"}
          </button>
        </div>

        {!collapsed && (
          <>
            <nav className={styles.sidebarLinks}>
              <div className={styles.sidebarSectionLabel}>Realty</div>
              <NavLink to="/admin/projects" className={activeClass}>Projects</NavLink>
              <NavLink to="/admin/projects/new" className={activeClass}>Add Project</NavLink>

              <div className={styles.sidebarSectionLabel}>Interio</div>
              <NavLink to="/admin/testimonials" className={activeClass}>Testimonials</NavLink>
              <NavLink to="/admin/enquiries" className={activeClass}>Interio Enquiries</NavLink>
              <NavLink to="/admin/addadmins" className={activeClass}>Add Admins</NavLink>

              <div className={styles.sidebarSectionLabel}>Other</div>
              <NavLink to="/admin/dashboard" className={activeClass}>Dashboard Overview</NavLink>
              <NavLink to="/admin/import" className={activeClass}>Bulk Import</NavLink>

              <button className={styles.sidebarViewsite} onClick={() => navigate("/")}>View site</button>
            </nav>

            <div className={styles.sidebarBottom}>
              <button className={styles.sidebarLogout} onClick={handleLogout}>Log out</button>
            </div>
          </>
        )}
      </aside>

      {/* Main content */}
      <main className={`${styles.dashboardContent} ${collapsed ? styles.contentSidebarCollapsed : ""}`}>
        <header className={styles.adminTopbar}>
          <div>
            <h2 className={styles.adminTitle}>Admin</h2>
            <div className={styles.adminSubtitle}>Manage projects, enquiries and other site content</div>
          </div>

          <div className={styles.adminActions}>
            <div className={styles.adminPhone}>{user?.phone || "—"}</div>
            <button className={styles.topbarSignout} onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        <section className="admin-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
