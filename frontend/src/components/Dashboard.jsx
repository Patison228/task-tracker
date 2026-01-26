import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Plus, LogOut, Trash2 } from "lucide-react";
import "../styles/Dashboard.css";

const Dashboard = () => {
  const { user, boards, logout, fetchBoards } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchBoards();
  }, []);

  const createBoard = async () => {
    const title = window.prompt("Название доски:");
    if (title && title.trim()) {
      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://localhost:5000/boards", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: title.trim() }),
        });

        if (response.ok) {
          await fetchBoards();
        } else {
          const error = await response.json();
          window.alert(error.message || "Ошибка создания доски");
        }
      } catch (err) {
        window.alert("Ошибка создания доски");
      }
    }
  };

  const deleteBoard = async (boardId, boardTitle, e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDeleting) return;

    if (
      window.confirm(
        `Удалить доску "${boardTitle}"? Все колонки и задачи будут удалены.`,
      )
    ) {
      setIsDeleting(true);
      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(
          `http://localhost:5000/boards/${boardId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          await fetchBoards();
        } else {
          const error = await response.json();
          window.alert(error.message || "Ошибка удаления доски");
        }
      } catch (err) {
        window.alert("Ошибка удаления доски");
      } finally {
        setIsDeleting(false);
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
          <button
            onClick={createBoard}
            className="btn-primary btn-create-board"
          >
            <Plus size={20} />
            Новая доска
          </button>
          <button onClick={logout} className="btn-logout">
            <LogOut size={24} />
          </button>
        </div>
      </header>

      {boards.length === 0 ? (
        <div className="empty-boards">
          <div className="empty-message">
            <h2>У вас пока нет досок</h2>
            <p>Создайте свою первую доску, чтобы начать работу</p>
            <button
              onClick={createBoard}
              className="btn-primary btn-create-first-board"
            >
              <Plus size={20} />
              Создать первую доску
            </button>
          </div>
        </div>
      ) : (
        <div className="boards-grid">
          {boards.map((board) => (
            <div key={board.id} className="board-card-wrapper">
              <Link to={`/board/${board.id}`} className="board-card">
                <div className="board-card-content">
                  <h3 className="board-title">{board.title}</h3>
                  <div className="board-preview"></div>
                </div>
              </Link>
              <button
                onClick={(e) => deleteBoard(board.id, board.title, e)}
                className="btn-delete-board"
                disabled={isDeleting}
                title="Удалить доску"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
