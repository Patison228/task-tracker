import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
window.__API_BASE_URL__ = API_BASE_URL;

console.log("API Base URL:", API_BASE_URL);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
