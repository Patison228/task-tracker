import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState([]);

  const API_BASE = "http://localhost:5000";

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchBoards();
    }
    setLoading(false);
  }, []);

  const fetchBoards = async () => {
    try {
      const res = await axios.get(`${API_BASE}/boards`);
      setBoards(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const login = async (username, password) => {
    try {
      const res = await axios.post(`${API_BASE}/login`, { username, password });
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      axios.defaults.headers.common["Authorization"] =
        `Bearer ${res.data.access_token}`;
      setUser({ username });
      fetchBoards();
      return true;
    } catch (err) {
      return false;
    }
  };

  const register = async (username, password) => {
    try {
      await axios.post(`${API_BASE}/register`, { username, password });
      return await login(username, password);
    } catch (err) {
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setBoards([]);
    delete axios.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider
      value={{ user, boards, login, register, logout, loading, fetchBoards }}
    >
      {children}
    </AuthContext.Provider>
  );
};
