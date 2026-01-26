import React from "react";
import { X } from "lucide-react";
import "../styles/Column.css";

const Column = ({ column, children, taskCount = 0, onAddTask, onDelete }) => {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (
      window.confirm(
        `Удалить колонку "${column.title}"? Все задачи в ней будут удалены.`,
      )
    ) {
      onDelete();
    }
  };

  return (
    <div className="column">
      <div className="column-header">
        <div className="column-title-container">
          <h3 className="column-title">{column.title}</h3>
          <span className="column-count">{taskCount}</span>
        </div>
        <button
          onClick={handleDelete}
          className="delete-column-btn"
          title="Удалить колонку"
        >
          <X size={16} />
        </button>
      </div>
      <div className="tasks-container">{children}</div>
      <button onClick={onAddTask} className="btn-secondary add-task-btn">
        + Добавить задачу
      </button>
    </div>
  );
};

export default Column;
