import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import LoginRegister from "./components/LoginRegister";
import Dashboard from "./components/Dashboard";
import Board from "./components/Board";
import "./styles/global.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LoginRegister />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
  {
    path: "/board/:boardId",
    element: <Board />,
  },
]);

function App() {
  return (
    <AuthProvider>
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)",
        }}
      >
        <RouterProvider router={router} />
      </div>
    </AuthProvider>
  );
}

export default App;
