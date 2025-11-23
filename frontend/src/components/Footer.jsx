// src/components/Footer.jsx
import React from "react";
import "../assets/components/Footer.css";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">

        {/* Left: Brand Info */}
        <div className="footer-brand">
          <h3>ATEN</h3>
          <p>Interio • Realty • Engineering</p>
        </div>

        {/* Middle: Quick Links */}
        <div className="footer-links">
          <Link to="/interio">Interio</Link>
          <Link to="/projects">Realty</Link>
          <Link to="/engineering">Engineering</Link>
        </div>

        {/* Right: Social Icons */}
        <div className="footer-social">
          <a href="#" aria-label="Instagram">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M7 2C4.243 2 2 4.243 2 7v10c0 
                2.757 2.243 5 5 5h10c2.757 0 
                5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm10 
                2c1.654 0 3 1.346 3 3v10c0 1.654-1.346 
                3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 
                1.346-3 3-3h10zm-5 3a5 5 0 100 10 5 5 
                0 000-10zm0 2a3 3 0 110 6 3 3 
                0 010-6zm4.5-.75a1.25 1.25 0 11-.001 
                2.501A1.25 1.25 0 0116.5 8.25z"
              />
            </svg>
          </a>

          <a href="#" aria-label="Facebook">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22 12a10 10 0 10-11.5 9.87v-6.99H8v-2.88h2.5V9.41c0-2.46 
                1.46-3.82 3.7-3.82 1.07 0 2.19.19 
                2.19.19v2.4h-1.23c-1.21 0-1.59.75-1.59 
                1.52v1.82H16.8l-.45 2.88h-2.67v6.99A10 
                10 0 0022 12z"
              />
            </svg>
          </a>

          <a href="#" aria-label="Twitter">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.46 6c-.77.35-1.6.59-2.46.69a4.28 
                4.28 0 001.88-2.37 8.59 8.59 0 01-2.72 
                1.04 4.27 4.27 0 00-7.4 3.89A12.1 12.1 
                0 013 4.79a4.27 4.27 0 001.32 5.7 4.24 
                4.24 0 01-1.94-.53v.05a4.27 4.27 0 
                003.42 4.18c-.47.13-.97.2-1.49.2-.36 0-.72-.03-1.07-.1a4.28 
                4.28 0 003.98 2.96A8.58 8.58 0 
                012 19.54 12.1 12.1 0 008.29 
                21c7.55 0 11.68-6.25 11.68-11.68 
                0-.18 0-.35-.01-.53A8.36 8.36 0 
                0022.46 6z"
              />
            </svg>
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        © {new Date().getFullYear()} ATEN • All rights reserved.
      </div>
    </footer>
  );
}
