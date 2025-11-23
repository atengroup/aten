// src/pages/admin/DashboardLayout.jsx
import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "../../assets/pages/admin/ProjectsAdmin.css"; // keep existing admin CSS
import "../../assets/pages/admin/ProjectForm.css";
import "../../assets/pages/admin/Dashboard.css"; // new (or append the rules below)
import { useAuth } from "../../context/AuthContext";

/**
 * DashboardLayout
 */
export default function DashboardLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth?.() || {};
  const [collapsed, setCollapsed] = useState(false);

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
    isActive ? "admin-nav-link active" : "admin-nav-link";

  return (
    <div className={`dashboard-container admin-shell`}>
      {/* Sidebar */}
     <aside className={`sidebar ${collapsed ? "collapsed" : "open"}`} aria-expanded={!collapsed}>
  
  {/* TOP: Brand + Toggle */}
  <div className="sidebar-top">
    {!collapsed && (
      <div className="sidebar-brand">
        <h3>Admin</h3>
        <div className="sidebar-user">{user?.name || "Administrator"}</div>
      </div>
    )}

    <button
      className="toggle-btn"
      onClick={toggleCollapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? "❯" : "❮"}
    </button>
  </div>

  {/* NAVIGATION only when NOT collapsed */}
  {!collapsed && (
    <>
      <nav className="sidebar-links">

        <div className="sidebar-section-label">Realty</div>
        <NavLink to="/admin/projects" className={activeClass}>
          Projects
        </NavLink>
        <NavLink to="/admin/projects/new" className={activeClass}>
          Add Project
        </NavLink>

        <div className="sidebar-section-label">Interio</div>
        <NavLink to="/admin/testimonials" className={activeClass}>
          Testimonials
        </NavLink>
        <NavLink to="/admin/enquiries" className={activeClass}>
          Interio Enquiries
        </NavLink>
        <NavLink to="/admin/addadmins" className={activeClass}>
          Add Admins
        </NavLink>

        <div className="sidebar-section-label">Other</div>
        <NavLink to="/admin/dashboard" className={activeClass}>
          Dashboard Overview
        </NavLink>
        <NavLink to="/admin/import" className={activeClass}>
          Bulk Import
        </NavLink>
        <button className="sidebar-viewsite" onClick={() => navigate("/")}>View site</button>

      </nav>

      {/* BOTTOM BUTTONS */}
      <div className="sidebar-bottom">
      </div>
    </>
  )}

</aside>


      {/* Main content */}
      <main className={`dashboard-content ${collapsed ? "sidebar-collapsed" : ""}`}>
        <header className="admin-topbar">
          <div>
            <h2 className="admin-title">Admin</h2>
            <div className="admin-subtitle">Manage projects, enquiries and other site content</div>
          </div>

          <div className="admin-actions">
            <div className="admin-phone">{user?.phone || "—"}</div>
            <button className="topbar-signout" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        <section className="admin-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
