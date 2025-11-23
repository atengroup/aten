import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../assets/components/Header.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburgerRef = useRef(null);
  const users = JSON.parse(localStorage.getItem("user"));
  const isAdmin = users?.isAdmin;
  const closeMenu = () => setMenuOpen(false);

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
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <Link to="/" onClick={() => closeMenu()}>
          <img src="/atenwhitelogo.png" alt="aTen Logo" className="logo-header" />
        </Link>
       
        <button
          ref={hamburgerRef}
          className={`hamburger ${menuOpen ? "active" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((s) => !s)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`nav-links ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen && window.innerWidth <= 768}>

          <Link to="/interio" className="whatsapp-no">Interio</Link>
          <Link to="/properties" className="whatsapp-no">Browse Properties</Link>

          <div className="contents-nav"> {isAdmin &&<Link to="/admin" onClick={() => closeMenu()}>
            <span className="whatsapp-no">Admin</span>
          </Link>}
          <Link to="/" onClick={() => closeMenu()}>
            <img className="whatsapp" src="/whatsapp.png" alt="WhatsApp" />
            <span className="whatsapp-no">9903611999</span>
          </Link>

          {/* other desktop links (visible on desktop) */}
          {/* <Link to="/browse" onClick={() => closeMenu()}>Browse</Link> */}

          <div className="mobile-auth">
            {!user ? (
              <button onClick={() => handleNavClick("/login")} className="login-btn">Login</button>
            ) : (
              <div className="user-section header-dropdown">
                <span className="username">Hi, {user?.name || user?.displayName || "User"}</span>
                <button onClick={handleLogout} className="logout-btn">Logout</button>
              </div>
            )}
          </div></div>
        </div>
      </nav>

      {/* overlay: sits under panel and closes it on click */}
      <div
        className={`nav-overlay ${menuOpen ? "open" : ""}`}
        onClick={() => closeMenu()}
        aria-hidden={!menuOpen}
      />
    </>
  );
}
