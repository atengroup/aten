// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

// Create the context
const AuthContext = createContext();

// Hook for components
export function useAuth() {
  return useContext(AuthContext);
}

// Provider
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { id, name, phone, isAdmin }
  const [token, setToken] = useState(null); // firebase id token
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("auth_token");
      if (storedUser) setUser(JSON.parse(storedUser));
      if (storedToken) setToken(storedToken);
    } catch (e) {
      console.error("Error reading auth from localStorage", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    try {
      if (user) localStorage.setItem("user", JSON.stringify(user));
      else localStorage.removeItem("user");
    } catch (e) {}
  }, [user]);

  useEffect(() => {
    try {
      if (token) localStorage.setItem("auth_token", token);
      else localStorage.removeItem("auth_token");
    } catch (e) {}
  }, [token]);

  // Called after Firebase phone auth is successful: send ID token to backend to create/return user
  // Accepts optional name param which will be passed to backend in POST body
  async function loginWithFirebaseIdToken(idToken, name = null) {
    setLoading(true);
    try {
      // Save token first so apiFetch will include it in Authorization header
      localStorage.setItem("auth_token", idToken);

      // include name in body if provided
      const body = name ? { name } : {};

      const res = await apiFetch("/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        localStorage.removeItem("auth_token");
        throw new Error(res.data?.error || "Auth failed");
      }

      // backend returns res.data.user with shape { id, uid, phone, name, isAdmin }
      const userFromServer = res.data.user;
      if (!userFromServer || typeof userFromServer.id === "undefined") {
        // defensive: if backend shape is unexpected, clear token and fail
        localStorage.removeItem("auth_token");
        throw new Error("Invalid auth response from server");
      }

      setUser(userFromServer);
      setToken(idToken);
      return userFromServer;
    } catch (err) {
      localStorage.removeItem("auth_token");
      setUser(null);
      setToken(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("auth_token");
      localStorage.removeItem("login_name");
      localStorage.removeItem("customer_phone");
    } catch (e) {}
  }

  const value = {
    user,
    token,
    loading,
    loginWithFirebaseIdToken,
    logout,
    isAdmin: user?.isAdmin === true,
    isLoggedIn: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
