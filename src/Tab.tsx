// DragItem.tsx
import React, { useEffect, useRef } from "react";

interface DragItemProps {
    id: string;
    dragHandler: (event: DragEvent) => Promise<void>;
    children?: React.ReactNode;
}

const DragItem: React.FC<DragItemProps> = ({ id, dragHandler, children }) => {
    const dragEl = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (dragEl.current) {
            dragEl.current.ondragstart = (event: DragEvent) => {
                dragHandler(event);
            };
        }
    }, [dragHandler]);

    return (
        <div ref={dragEl} draggable="true" id={id} className="drag-item">
            {`Drag me ${id}`}
            {children}
        </div>
    );
};

export default DragItem;
