import { useEffect, useRef } from "react";
import { warn } from "tauri-plugin-log-api";

import { appWindow } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import { dragBack, CallbackPayload } from "./libs/drag-window.tsx";
import "./App.css";

function NewWindow() {
    const dragZoneRef = useRef<HTMLDivElement>(null);
    const windowLabel = appWindow.label;
    const isMounted = useRef(false);

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            warn("Hello I am from Window " + windowLabel);
        
            listen(`init-${windowLabel}`, (event) => {
                initPage(event);
            });

            emit(`loaded-${windowLabel}`, {
                window: windowLabel,
            });
        }
    }, []);

    const initPage = (event: any) => {
        if (dragZoneRef.current) {
            const dragEl = document.createElement("div");
            dragEl.setAttribute("draggable", "true");
            dragEl.id = event.payload.id;
            dragEl.className = "drag-item";
            dragEl.innerText = `Drag me ${event.payload.id}`;
            dragZoneRef.current.appendChild(dragEl);
            dragEl.ondragstart = dragHandler;
        }
    };

    const dragHandler = async (event: DragEvent) => {
        event.preventDefault();
        warn("dragging");

        const el = event.target as HTMLDivElement;
        await dragBack(el, { id: el.id }, async (payload: CallbackPayload) => {
            warn("drag back callback");
            await appWindow.close();
        });
    };

    return <div ref={dragZoneRef} className="drag-zone"></div>;
}

export default NewWindow;
