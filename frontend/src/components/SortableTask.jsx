import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import "../styles/SortableTask.css";

const SortableTask = ({ id, task, onDelete, data }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-task ${isDragging ? "dragging" : ""}`}
    >
      <div className="task-content">
        <div className="task-header">
          <div className="task-main" {...attributes} {...listeners}>
            <GripVertical size={16} className="grip-icon" />
            <h4 className="task-title">{task.title}</h4>
          </div>
          <button onClick={handleDelete} className="delete-btn">
            <X size={16} />
          </button>
        </div>
        {task.description && (
          <p className="task-description">{task.description}</p>
        )}
        <div className="task-footer">
          <span className="task-position">#{task.position + 1}</span>
          {task.deadline && (
            <span className="task-deadline">
              {new Date(task.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SortableTask;
