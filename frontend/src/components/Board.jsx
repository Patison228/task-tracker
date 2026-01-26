import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import Column from "./Column";
import Task from "./Task";
import "../styles/Board.css";

const Board = () => {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState({});
  const [newColumnTitle, setNewColumnTitle] = useState("");

  const fetchColumns = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:5000/boards/${boardId}/columns`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const cols = await res.json();
      const sortedColumns = cols.sort((a, b) => a.position - b.position);
      setColumns(sortedColumns);

      const tasksData = {};
      for (const col of sortedColumns) {
        const taskRes = await fetch(
          `http://localhost:5000/columns/${col.id}/tasks`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const colTasks = await taskRes.json();
        tasksData[col.id] = colTasks.sort((a, b) => a.position - b.position);
      }
      setTasks(tasksData);
    } catch (err) {
      console.error(err);
    }
  }, [boardId]);

  useEffect(() => {
    fetchColumns();
  }, [boardId, fetchColumns]);

  const createColumn = async () => {
    if (!newColumnTitle.trim()) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:5000/boards/${boardId}/columns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newColumnTitle,
          position: columns.length,
        }),
      });
      setNewColumnTitle("");
      fetchColumns();
    } catch (err) {
      window.alert("Ошибка создания колонки");
    }
  };

  const deleteColumn = async (columnId) => {
    if (!window.confirm("Удалить колонку и все задачи в ней?")) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:5000/columns/${columnId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchColumns();
    } catch (err) {
      window.alert("Ошибка удаления колонки");
    }
  };

  const createTask = async (columnId) => {
    const title = window.prompt("Название задачи:");
    if (!title?.trim()) return;
    try {
      const token = localStorage.getItem("access_token");
      const colTasks = tasks[columnId] || [];
      await fetch(`http://localhost:5000/columns/${columnId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          position: colTasks.length,
        }),
      });
      fetchColumns();
    } catch (err) {
      window.alert("Ошибка создания задачи");
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm("Удалить задачу?")) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:5000/tasks/${taskId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchColumns();
    } catch (err) {
      window.alert("Ошибка удаления");
    }
  };

  const moveTask = async (taskId, direction) => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `http://localhost:5000/tasks/${taskId}/move`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ direction }),
        },
      );

      if (response.ok) {
        fetchColumns();
      } else {
        const error = await response.json();
        window.alert(error.message || "Ошибка перемещения задачи");
      }
    } catch (err) {
      console.error("Ошибка перемещения задачи:", err);
      window.alert("Ошибка перемещения задачи");
    }
  };

  // Определяем, можно ли переместить задачу влево/вправо
  const canMoveTask = (task, columnId) => {
    const columnIndex = columns.findIndex((col) => col.id === columnId);
    return {
      left: columnIndex > 0,
      right: columnIndex < columns.length - 1,
    };
  };

  return (
    <div className="board-container">
      <div className="board-content">
        <header className="board-header">
          <button
            onClick={() => navigate("/dashboard")}
            className="back-button"
          >
            ← Назад к доскам
          </button>
          <h1 className="board-title">Доска #{boardId}</h1>
        </header>

        <div className="column-creator">
          <input
            value={newColumnTitle}
            onChange={(e) => setNewColumnTitle(e.target.value)}
            placeholder="Название новой колонки..."
            className="input-field column-input"
            onKeyPress={(e) => e.key === "Enter" && createColumn()}
          />
          <button onClick={createColumn} className="btn-primary column-btn">
            Добавить колонку
          </button>
        </div>

        <div className="columns-container">
          {columns.map((column, columnIndex) => (
            <Column
              key={column.id}
              column={column}
              taskCount={(tasks[column.id] || []).length}
              onAddTask={() => createTask(column.id)}
              onDelete={() => deleteColumn(column.id)} 
            >
              {(tasks[column.id] || []).map((task) => {
                const { left, right } = canMoveTask(task, column.id);
                return (
                  <Task
                    key={task.id}
                    task={task}
                    onDelete={() => deleteTask(task.id)}
                    onMoveLeft={() => moveTask(task.id, "left")}
                    onMoveRight={() => moveTask(task.id, "right")}
                    canMoveLeft={left}
                    canMoveRight={right}
                  />
                );
              })}
            </Column>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Board;
