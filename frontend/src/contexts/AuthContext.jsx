import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState([]);

  const API_BASE = window.__API_BASE_URL__;

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetchBoards();
    }
    setLoading(false);
  }, []);

  const fetchBoards = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/api/boards`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch boards");
      }

      const data = await res.json();
      setBoards(data);
    } catch (err) {
      console.error(err);
      setBoards([]);
    }
  };

  const login = async (username, password) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);

      if (data.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token);
      }

      setUser({ username });
      await fetchBoards();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const register = async (username, password) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        return false;
      }

      return await login(username, password);
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setBoards([]);
  };

  return (
    <AuthContext.Provider
      value={{ user, boards, login, register, logout, loading, fetchBoards }}
    >
      {children}
    </AuthContext.Provider>
  );
};
