import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";
import "../assets/pages/admin/Dashboard.css";

export default function Sidebar() {


  return (
    <div className="sidebar open">
      <div className="sidebar-links">
        <Link to="/admin/dashboard">Dashboard</Link>
        <Link to="/admin/testimonials">Testimonials</Link>
        <Link to="/admin/pricing">Pricing</Link>
        <Link to="/admin/properties">Properties</Link>
      </div>

    </div>
  );
}
