import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import "../styles/SortableTask.css";

const SortableTask = ({ id, task, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-task ${isDragging ? "dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="task-header">
        <div className="task-main">
          <GripVertical size={16} className="grip-icon" />
          <h4 className="task-title">{task.title}</h4>
        </div>
        <button onClick={onDelete} className="delete-btn">
          <X size={16} />
        </button>
      </div>
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
      <div className="task-footer">
        <span className="task-position">#{task.position + 1}</span>
        <span className="task-column">Колонка {task.column_id}</span>
      </div>
    </div>
  );
};

export default SortableTask;
