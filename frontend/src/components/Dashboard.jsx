import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Plus, LogOut } from "lucide-react";
import "../styles/Dashboard.css";

const Dashboard = () => {
  const { user, boards, logout, fetchBoards } = useAuth();

  const createBoard = async () => {
    const title = window.prompt("Название доски:");
    if (title) {
      try {
        await fetch("http://localhost:5000/boards", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ title }),
        });
        await fetchBoards();
      } catch (err) {
        window.alert("Ошибка создания доски");
      }
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">Мои доски</h1>
          <p className="user-name">{user?.username}</p>
        </div>
        <div className="header-actions">
          <button onClick={createBoard} className="btn-create-board">
            <Plus size={20} />
            Новая доска
          </button>
          <button onClick={logout} className="btn-logout">
            <LogOut size={24} />
          </button>
        </div>
      </header>

      <div className="boards-grid">
        {boards.map((board) => (
          <Link key={board.id} to={`/board/${board.id}`} className="board-card">
            <h3 className="board-title">{board.title}</h3>
            <div className="board-preview"></div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
