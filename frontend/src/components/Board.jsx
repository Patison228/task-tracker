import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
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
  const [activeId, setActiveId] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fetchColumns = useCallback(async () => {
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
      const sortedColumns = cols.sort((a, b) => a.position - b.position);
      setColumns(sortedColumns);

      const tasksData = {};
      for (const col of sortedColumns) {
        const taskRes = await fetch(
          `http://localhost:5000/columns/${col.id}/tasks`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
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
      await fetch(`http://localhost:5000/boards/${boardId}/columns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
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

  const createTask = async (columnId) => {
    const title = window.prompt("Название задачи:");
    if (!title?.trim()) return;
    try {
      const colTasks = tasks[columnId] || [];
      await fetch(`http://localhost:5000/columns/${columnId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
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

  const updateTask = async (taskId, updates) => {
    try {
      const response = await fetch(`http://localhost:5000/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify(updates),
      });
      return response.ok;
    } catch (err) {
      console.error("Ошибка обновления задачи:", err);
      return false;
    }
  };

  const updateColumnPosition = async (columnId, newPosition) => {
    try {
      const response = await fetch(
        `http://localhost:5000/columns/${columnId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ position: newPosition }),
        },
      );
      return response.ok;
    } catch (err) {
      console.error("Ошибка обновления колонки:", err);
      return false;
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

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);

    // Определяем тип перетаскиваемого элемента
    const data = active.data.current;
    if (data?.type === "task") {
      setActiveType("task");
      // Находим задачу
      for (const [columnId, columnTasks] of Object.entries(tasks)) {
        const task = columnTasks.find((t) => t.id === active.id);
        if (task) {
          setActiveTask(task);
          break;
        }
      }
    } else {
      setActiveType("column");
    }
  };

  const handleDragOver = (event) => {
    const { active, over } = event;

    if (!over) return;
    if (active.id === over.id) return;

    // Если перетаскиваем колонку
    if (active.data.current?.type === "column") {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);

      if (oldIndex !== newIndex && newIndex >= 0) {
        setColumns((items) => arrayMove(items, oldIndex, newIndex));
      }
    }
    // Если перетаскиваем задачу - обрабатываем в handleDragEnd
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over) {
      resetDragState();
      return;
    }

    try {
      // Если перетаскиваем колонку
      if (active.data.current?.type === "column") {
        const oldIndex = columns.findIndex((col) => col.id === active.id);
        const newIndex = columns.findIndex((col) => col.id === over.id);

        if (oldIndex !== newIndex && newIndex >= 0) {
          // Сохраняем новое положение
          const newColumns = arrayMove(columns, oldIndex, newIndex);

          // Обновляем позиции на сервере
          const updatePromises = newColumns.map((column, index) =>
            updateColumnPosition(column.id, index),
          );

          await Promise.all(updatePromises);
          await fetchColumns(); // Синхронизируем
        }
      }
      // Если перетаскиваем задачу
      else if (active.data.current?.type === "task") {
        await handleTaskDragEnd(active, over);
      }
    } catch (error) {
      console.error("Ошибка при перетаскивании:", error);
      await fetchColumns(); // Перезагружаем при ошибке
    } finally {
      resetDragState();
    }
  };

  const handleTaskDragEnd = async (active, over) => {
    const activeId = active.id;
    const overId = over.id;

    // Находим исходную колонку
    let sourceColumnId = null;
    for (const [colId, colTasks] of Object.entries(tasks)) {
      if (colTasks.some((task) => task.id === activeId)) {
        sourceColumnId = colId;
        break;
      }
    }

    if (!sourceColumnId) return;

    // Находим целевую колонку
    let targetColumnId = null;
    if (over.data.current?.type === "column") {
      targetColumnId = over.id;
    } else {
      for (const [colId, colTasks] of Object.entries(tasks)) {
        if (colTasks.some((task) => task.id === overId)) {
          targetColumnId = colId;
          break;
        }
      }
    }

    if (!targetColumnId) return;

    const sourceTasks = tasks[sourceColumnId] || [];
    const targetTasks = tasks[targetColumnId] || [];

    // Находим индекс активной задачи
    const activeIndex = sourceTasks.findIndex((task) => task.id === activeId);
    if (activeIndex === -1) return;

    const movedTask = sourceTasks[activeIndex];

    if (sourceColumnId === targetColumnId) {
      // Перемещение внутри одной колонки
      const overIndex = targetTasks.findIndex((task) => task.id === overId);

      if (activeIndex !== overIndex && overIndex >= 0) {
        // Создаем новый массив с обновленными позициями
        const newTasks = arrayMove(targetTasks, activeIndex, overIndex);

        // Обновляем позиции на сервере
        const updatePromises = newTasks.map((task, idx) =>
          updateTask(task.id, {
            column_id: targetColumnId,
            position: idx,
          }),
        );

        await Promise.all(updatePromises);
        await fetchColumns();
      }
    } else {
      // Перемещение между колонками
      let newPosition = targetTasks.length;

      if (over.data.current?.type === "task") {
        const overIndex = targetTasks.findIndex((task) => task.id === overId);
        newPosition = overIndex >= 0 ? overIndex : targetTasks.length;
      }

      // Обновляем перемещенную задачу
      await updateTask(activeId, {
        column_id: targetColumnId,
        position: newPosition,
      });

      // Обновляем позиции в исходной колонке
      const newSourceTasks = sourceTasks.filter((task) => task.id !== activeId);
      const sourceUpdates = newSourceTasks.map((task, idx) =>
        updateTask(task.id, { position: idx }),
      );

      // Обновляем позиции в целевой колонке
      const targetUpdates = targetTasks.map((task, idx) => {
        if (idx >= newPosition) {
          return updateTask(task.id, { position: idx + 1 });
        }
        return updateTask(task.id, { position: idx });
      });

      await Promise.all([...sourceUpdates, ...targetUpdates]);
      await fetchColumns();
    }
  };

  const handleDragCancel = () => {
    resetDragState();
  };

  const resetDragState = () => {
    setActiveId(null);
    setActiveType(null);
    setActiveTask(null);
  };

  // Получаем все ID задач для SortableContext
  const allTaskIds = Object.values(tasks)
    .flat()
    .map((task) => task.id);

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
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="columns-container">
            <SortableContext
              items={columns.map((col) => col.id)}
              strategy={horizontalListSortingStrategy}
            >
              {columns.map((column) => (
                <SortableColumn
                  key={column.id}
                  id={column.id}
                  column={column}
                  taskCount={(tasks[column.id] || []).length}
                  data={{ type: "column" }}
                >
                  <div className="tasks-container">
                    <SortableContext
                      items={(tasks[column.id] || []).map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {(tasks[column.id] || []).map((task) => (
                        <SortableTask
                          key={task.id}
                          id={task.id}
                          task={task}
                          onDelete={() => deleteTask(task.id)}
                          data={{ type: "task" }}
                        />
                      ))}
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

          <DragOverlay dropAnimation={null}>
            {activeType === "task" && activeTask ? (
              <div className="task-overlay">
                <div className="sortable-task dragging">
                  <div className="task-content">
                    <div className="task-header">
                      <div className="task-main">
                        <div className="grip-icon"></div>
                        <h4 className="task-title">{activeTask.title}</h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeType === "column" && activeId ? (
              <div className="column-overlay">
                <div className="sortable-column dragging">
                  <div className="column-header">
                    <div className="grip-icon"></div>
                    <h3 className="column-title">
                      {columns.find((c) => c.id === activeId)?.title ||
                        "Колонка"}
                    </h3>
                    <span className="column-count">
                      {(tasks[activeId] || []).length}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default Board;
