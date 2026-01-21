import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import "../styles/SortableColumn.css";

const SortableColumn = ({ id, column, children, data }) => {
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
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-column ${isDragging ? "dragging" : ""}`}
    >
      <div className="column-header" {...attributes} {...listeners}>
        <GripVertical size={20} className="grip-icon" />
        <h3 className="column-title">{column.title}</h3>
        <span className="column-count">
          {React.Children.toArray(children)[0]?.props?.children?.length || 0}
        </span>
      </div>
      {children}
    </div>
  );
};

export default SortableColumn;
