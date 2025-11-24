// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

// Read Vite backend base (fall back to same-origin)
const RAW_BACKEND_BASE = typeof import.meta !== "undefined" ? (import.meta.env.VITE_BACKEND_BASE || "") : "";
const BACKEND_BASE = RAW_BACKEND_BASE.replace(/\/+$/, ""); // remove trailing slash(s)
const buildUrl = (path) => {
  if (!BACKEND_BASE) return path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_BASE}${path.startsWith("/") ? "" : "/"}${path}`.replace(/([^:]\/)\/+/g, "$1");
};

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { id, uid, phone, email, name, isAdmin }
  const [token, setToken] = useState(null); // firebase id token
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    try {
      if (user) localStorage.setItem("user", JSON.stringify(user));
      else localStorage.removeItem("user");
    } catch (e) {
      console.warn("Failed to persist user to localStorage", e);
    }
  }, [user]);

  useEffect(() => {
    try {
      if (token) localStorage.setItem("auth_token", token);
      else localStorage.removeItem("auth_token");
    } catch (e) {
      console.warn("Failed to persist token to localStorage", e);
    }
  }, [token]);

  // Calls the public ensure-user endpoint which now requires only email (and optional name)
  async function checkAdminEnsureUserByEmail(email) {
    try {
      if (!email) return { isAdmin: false };

      const base = BACKEND_BASE.replace(/\/+$/, "");
      const url = base ? `${base}/api/admin/ensure-user` : `/api/admin/ensure-user`;

      const authToken = token || localStorage.getItem("auth_token") || null;
      if (!authToken) return { isAdmin: false };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email }),
      });

      // 403 -> not admin
      if (res.status === 403) return { isAdmin: false };

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.warn("checkAdminEnsureUserByEmail non-ok:", res.status, data);
        return { isAdmin: false };
      }

      // On success expect { user: {...} } where user.isAdmin === true
      if (data && data.user) return { isAdmin: !!data.user.isAdmin, user: data.user };
      return { isAdmin: false };
    } catch (e) {
      console.warn("checkAdminEnsureUserByEmail failed:", e);
      return { isAdmin: false };
    }
  }

  /**
   * idToken: Firebase ID token
   * name: optional
   * email: optional (preferred: pass here to ensure backend gets email)
   */
  async function loginWithFirebaseIdToken(idToken, name = null, email = null) {
    setLoading(true);
    try {
      if (!idToken) throw new Error("No idToken provided");

      try {
        localStorage.setItem("auth_token", idToken);
      } catch (e) {
        console.warn("Could not write auth_token to localStorage", e);
      }

      // send name and email (email now included) to /auth
      const body = {};
      if (name) body.name = name;
      if (email) body.email = email;

      const res = await apiFetch("/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res || typeof res.ok === "undefined") {
        localStorage.removeItem("auth_token");
        throw new Error("Invalid response from auth server");
      }

      if (!res.ok) {
        localStorage.removeItem("auth_token");
        setUser(null);
        setToken(null);

        if (res.status === 409) {
          const msg = res.data?.error || "Email or phone already exists";
          const err = new Error(msg);
          err.status = 409;
          throw err;
        }

        const msg = res.data?.error || "Auth failed";
        const err = new Error(msg);
        err.status = res.status || 500;
        throw err;
      }

      const userFromServer = res.data && res.data.user ? res.data.user : null;
      if (!userFromServer || typeof userFromServer.id === "undefined") {
        localStorage.removeItem("auth_token");
        setUser(null);
        setToken(null);
        throw new Error("Invalid auth response from server");
      }

      // Prefer server isAdmin; if false, call ensure-user by email only
      let finalIsAdmin = !!userFromServer.isAdmin;
      let ensuredUser = null;

      if (!finalIsAdmin) {
        // prefer the email from server, otherwise use the passed email
        const emailToCheck = userFromServer.email || email || null;
        if (emailToCheck) {
          try {
            const result = await checkAdminEnsureUserByEmail(emailToCheck);
            finalIsAdmin = !!result.isAdmin;
            if (result.user) ensuredUser = result.user;
          } catch (e) {
            console.warn("admin ensure-user check failed, defaulting to false", e);
            finalIsAdmin = false;
          }
        }
      }

      const finalUser = { ...(ensuredUser || userFromServer), isAdmin: !!finalIsAdmin };

      // Persist some helper fields used elsewhere
      try {
        if (finalUser.name) localStorage.setItem("login_name", finalUser.name);
        if (finalUser.phone) localStorage.setItem("customer_phone", finalUser.phone);
      } catch (e) {
        console.warn("Failed to persist login_name/customer_phone", e);
      }

      setUser(finalUser);
      setToken(idToken);

      return finalUser;
    } catch (err) {
      try { localStorage.removeItem("auth_token"); } catch (e) {}
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
    } catch (e) {
      console.warn("Failed to clear localStorage during logout", e);
    }
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
