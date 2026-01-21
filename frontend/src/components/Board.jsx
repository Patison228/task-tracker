import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import SortableColumn from "./SortableColumn";
import SortableTask from "./SortableTask";
import "../styles/Board.css";

const Board = () => {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState({});
  const [newColumnTitle, setNewColumnTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fetchColumns = async () => {
    try {
      const res = await fetch(
        `http://localhost:5000/boards/${boardId}/columns`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        },
      );
      const cols = await res.json();
      setColumns(cols);

      const tasksData = {};
      for (const col of cols) {
        const taskRes = await fetch(
          `http://localhost:5000/columns/${col.id}/tasks`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
          },
        );
        tasksData[col.id] = await taskRes.json();
      }
      setTasks(tasksData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchColumns();
  }, [boardId]);

  const createColumn = async () => {
    if (!newColumnTitle.trim()) return;
    try {
      await fetch(`http://localhost:5000/boards/${boardId}/columns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ title: newColumnTitle }),
      });
      setNewColumnTitle("");
      fetchColumns();
    } catch (err) {
      window.alert("Ошибка создания колонки");
    }
  };

  const createTask = async (columnId) => {
    const title = window.prompt("Название задачи:");
    if (!title?.trim()) return;
    try {
      await fetch(`http://localhost:5000/columns/${columnId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ title }),
      });
      fetchColumns();
    } catch (err) {
      window.alert("Ошибка создания задачи");
    }
  };

  const updateTask = async (taskId, updates) => {
    try {
      await fetch(`http://localhost:5000/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error("Ошибка обновления задачи:", err);
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm("Удалить задачу?")) return;
    try {
      await fetch(`http://localhost:5000/tasks/${taskId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });
      fetchColumns();
    } catch (err) {
      window.alert("Ошибка удаления");
    }
  };

  const findContainer = (id) => {
    if (columns.find((c) => c.id === id)) return id;
    const taskCol = Object.values(tasks)
      .flat()
      .find((t) => t.id === id);
    return taskCol ? taskCol.column_id : null;
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);

    if (activeContainer !== overContainer) {
      await updateTask(active.id, {
        column_id: overContainer,
        position: tasks[overContainer]?.length || 0,
      });
      fetchColumns();
      return;
    }

    const columnTasks = tasks[activeContainer] || [];
    const oldIndex = columnTasks.findIndex((task) => task.id === active.id);
    const newIndex = columnTasks.findIndex((task) => task.id === over.id);

    if (oldIndex !== newIndex) {
      const newTasks = arrayMove(columnTasks, oldIndex, newIndex);

      newTasks.forEach(async (task, idx) => {
        await updateTask(task.id, { position: idx });
      });

      setTasks((prev) => ({
        ...prev,
        [activeContainer]: newTasks,
      }));
    }
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="columns-container">
            <SortableContext
              items={[
                ...columns.map((c) => c.id),
                ...Object.values(tasks)
                  .flat()
                  .map((t) => t.id),
              ]}
            >
              {columns.map((column) => (
                <SortableColumn key={column.id} id={column.id} column={column}>
                  <div className="tasks-container">
                    <SortableContext
                      items={tasks[column.id]?.map((t) => t.id) || []}
                      strategy={verticalListSortingStrategy}
                    >
                      {tasks[column.id]?.map((task) => (
                        <SortableTask
                          key={task.id}
                          id={task.id}
                          task={task}
                          onDelete={() => deleteTask(task.id)}
                        />
                      )) || null}
                    </SortableContext>
                  </div>
                  <button
                    onClick={() => createTask(column.id)}
                    className="btn-secondary add-task-btn"
                  >
                    <Plus size={20} />
                    Добавить задачу
                  </button>
                </SortableColumn>
              ))}
            </SortableContext>
          </div>
        </DndContext>
      </div>
    </div>
  );
};

export default Board;
