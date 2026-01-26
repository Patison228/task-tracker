import React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import "../styles/Task.css";

const Task = ({
  task,
  onDelete,
  onMoveLeft,
  onMoveRight,
  canMoveLeft,
  canMoveRight,
}) => {
  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete();
  };

  const handleMoveLeft = (e) => {
    e.stopPropagation();
    if (canMoveLeft && onMoveLeft) {
      onMoveLeft();
    }
  };

  const handleMoveRight = (e) => {
    e.stopPropagation();
    if (canMoveRight && onMoveRight) {
      onMoveRight();
    }
  };

  return (
    <div className="task-card">
      <div className="task-header">
        <div className="task-main">
          <h4 className="task-title">{task.title}</h4>
        </div>
        <div className="task-actions">
          <button
            onClick={handleMoveLeft}
            className={`move-btn ${!canMoveLeft ? "disabled" : ""}`}
            disabled={!canMoveLeft}
            title="Переместить влево"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleMoveRight}
            className={`move-btn ${!canMoveRight ? "disabled" : ""}`}
            disabled={!canMoveRight}
            title="Переместить вправо"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleDelete}
            className="delete-btn"
            title="Удалить задачу"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      <div className="task-footer">
        <span className="task-position">Позиция: {task.position + 1}</span>
        <span className="task-meta">
          {task.created_at && new Date(task.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

export default Task;
