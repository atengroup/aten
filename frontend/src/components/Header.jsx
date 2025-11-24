// src/components/Header.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "../assets/components/Header.module.css";
import EmailLoginModal from "./EmailLoginModal";

/*
  Optional: Put logo assets in public/
    - aten-logo-white.png  (white version)
    - aten-logo-color.png  (colored version)
  If you only have one logo, update FALLBACK_LOGO accordingly.
*/
const LOGO_WHITE = "/aten-logo-white.png";
const LOGO_COLOR = "/aten-logo-color.png";
const FALLBACK_LOGO = "/atenwhitelogo.png";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const hamburgerRef = useRef(null);
  const users = (() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch (e) {
      return null;
    }
  })();
  const isAdmin = users?.isAdmin;
  const closeMenu = () => setMenuOpen(false);

  // Select logo: prefer white for dark nav; fallback to colored or original.
  const logoSrc = "/atenlogo.png";

  const handleNavClick = (path) => {
    closeMenu();
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      closeMenu();
      navigate("/");
    }
  };

  // lock body scrolling when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // close on Escape and on window resize (desktop)
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeMenu(); };
    const onResize = () => { if (window.innerWidth > 768 && menuOpen) closeMenu(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  return (
    <>
      <nav className={styles.navbar} role="navigation" aria-label="Main navigation">
        <Link to="/" onClick={() => closeMenu()} className={styles.logoLink}>
            <img src={logoSrc} alt="aTen Logo" className={styles.logoHeader} />
        </Link>

        <button
          ref={hamburgerRef}
          className={`${styles.hamburger} ${menuOpen ? styles.active : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((s) => !s)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>

        <div
          className={`${styles.navLinks} ${menuOpen ? styles.open : ""}`}
          aria-hidden={!menuOpen && window.innerWidth <= 768}
        >
          <Link to="/interio" className={styles.link} onClick={() => closeMenu()}>Interio</Link>
          <Link to="/projects" className={styles.link} onClick={() => closeMenu()}>Browse Properties</Link>

          <div className={styles.contentsNav}>
            {isAdmin && (
              <Link to="/admin" className={styles.link} onClick={() => closeMenu()}>
                <span>Admin</span>
              </Link>
            )}

            <div className={styles.mobileAuth}>
              {!user ? (
                // OPEN AUTH MODAL instead of navigating to /login
                <button
                  onClick={() => {
                    setAuthModalOpen(true);
                    closeMenu();
                  }}
                  className={styles.loginBtn}
                >
                  Login
                </button>
              ) : (
                <div className={`${styles.userSection} ${styles.headerDropdown}`}>
                  <span className={styles.username}>
                    Hi, {user?.name || user?.displayName || "User"}
                  </span>
                  <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div
        className={`${styles.navOverlay} ${menuOpen ? styles.open : ""}`}
        onClick={() => closeMenu()}
        aria-hidden={!menuOpen}
      />

      {/* Auth modal: open when authModalOpen === true */}
      {authModalOpen && (
        <EmailLoginModal
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => {
            // Modal already calls loginWithFirebaseIdToken and updates backend.
            // Close the modal and optionally navigate or refresh UI.
            setAuthModalOpen(false);
            closeMenu();
            // no navigate required — user state will update via useAuth
          }}
        />
      )}
    </>
  );
}
