// src/components/Header.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "../assets/components/Header.module.css";
import EmailLoginModal from "./EmailLoginModal";

const LOGO_WHITE = "/aten-logo-white.png";
const LOGO_COLOR = "/aten-logo-color.png";
const FALLBACK_LOGO = "/atenwhitelogo.png";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const users = (() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch (e) {
      return null;
    }
  })();
  const isAdmin = users?.isAdmin;

  const logoSrc = "/atenlogo.png";

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      navigate("/");
    }
  };

  return (
    <>
      <nav className={styles.navbar} role="navigation" aria-label="Main navigation">
        {/* Logo */}
        <Link to="/" className={styles.logoLink}>
          <img src={logoSrc} alt="aTen Logo" className={styles.logoHeader} />
        </Link>

        {/* Desktop / tablet links (hidden on mobile via CSS) */}
        <div className={styles.navLinks}>
          <Link to="/interio" className={styles.link}>Interio</Link>
          <Link to="/projects" className={styles.link}>Browse Properties</Link>

          {isAdmin && (
            <Link to="/admin" className={styles.link}>
              <span>Admin</span>
            </Link>
          )}
        </div>

        {/* Auth section – visible on all screens, but on mobile it becomes the only thing beside the logo */}
        <div className={styles.auth}>
          {!user ? (
            <button
              onClick={() => setAuthModalOpen(true)}
              className={styles.loginBtn}
              type="button"
            >
              Login
            </button>
          ) : (
            <div className={styles.userSection}>
              <span className={styles.username}>
                Hi, {user?.name || user?.displayName || "User"}
              </span>
              <button onClick={handleLogout} className={styles.logoutBtn} type="button">
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Auth modal */}
      {authModalOpen && (
        <EmailLoginModal
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => {
            setAuthModalOpen(false);
          }}
        />
      )}
    </>
  );
}
