import { useEffect, useRef, useState } from "react";
import { warn } from "tauri-plugin-log-api";

import { PhysicalPosition, PhysicalSize, WebviewWindow, appWindow } from "@tauri-apps/api/window";
import { window as tauriWindow } from "@tauri-apps/api";
import { listen, emit } from "@tauri-apps/api/event";
import { dragBack, CallbackPayload, onElementDrop } from "./libs/drag-window.tsx";
import Tab from "./Tab";


function NewWindow() {
    const dragZoneRef = useRef<HTMLDivElement>(null);
    const windowLabel = appWindow.label;
    const isMounted = useRef(false);
    const [tabs, setTabs] = useState([] as string[]);
    
    const checkCursorInsideWindow = async (appWindow: WebviewWindow, cursorX: number, cursorY: number): Promise<boolean> => {
        const position: PhysicalPosition = await appWindow.outerPosition();
        const size: PhysicalSize = await appWindow.outerSize();
        const scale: number = await appWindow.scaleFactor();
        const { x: windowX, y: windowY } = position.toLogical(scale);
        const { width, height } = size.toLogical(scale);
    
        // get window boundaries
        const windowLeft = windowX;
        const windowTop = windowY;
        const windowRight = windowX + width;
        const windowBottom = windowY + height;
    
        // debug
        // console.log({ windowX, windowY }, { width, height });
        // console.log({ cursorX, cursorY });
    
        // if cursor is inside the window, return
        if (cursorX >= windowLeft && cursorX <= windowRight && cursorY >= windowTop && cursorY <= windowBottom) {
            return true;
        }
    
        return false;
    };
    

    useEffect(() => {
        if (!isMounted.current) {
            listen(`init-${windowLabel}`, (event) => {
                initPage(event);
            });

            emit(`loaded-${windowLabel}`, {
                window: windowLabel,
            });

            // doesnt work?
            // onElementDrop((data) => {
            //     warn("<><><><><>  I am being dropped on the window");
            // });

            isMounted.current = true;
        }
        const unlisten = listen<string>(`add-tab-${windowLabel}`, (event: { payload: any }) => {
            warn("<><><><><>  dropping item " + event.payload.id);
            addTab(event.payload.id);
        });

        return () => {
            unlisten.then((f) => f());
        };
    }, []);

    const initPage = (event: any) => {
        if (dragZoneRef.current) {
            // const dragEl = document.createElement("div");
            // dragEl.setAttribute("draggable", "true");
            // dragEl.id = event.payload.id;
            // dragEl.className = "drag-item";
            // dragEl.innerText = `Drag me ${event.payload.id}`;
            // dragZoneRef.current.appendChild(dragEl);
            // dragEl.ondragstart = dragHandler;
            addTab(event.payload.id);
        }
    };

    const addTab = (id: string) => {
        warn("appendItem " + id);
        // append <Tab> to dropZoneRef with name id, dragHandler

        const newItemId = `${id}`;
        setTabs((prevTabs) => [...prevTabs, newItemId]);
    };

    const removeTab = (id: string) => {
        setTabs((prevTabs) => prevTabs.filter((tabId) => tabId !== id));
    }

    const dragHandler = async (event: DragEvent) => {
        event.preventDefault();
        warn("dragging");

        const el = event.target as HTMLDivElement;
        await dragBack(el, { id: el.id }, async (payload: CallbackPayload) => {
            warn("drag back callback" + tabs.length);
            const res = await checkCursorInsideWindow(appWindow, payload.cursorPos.x as number, payload.cursorPos.y as number);
            if (tabs.length == 1 && !res) {
                warn("closing window " + el.id + " " + tabs.length + " " + res);
                await appWindow.close();
            } else if (!res) {
                warn("removing tab " + el.id);
                removeTab(el.id);
            }
        });
    };

    const unmount = appWindow.listen(`add-item-${windowLabel}`, (event) => {
        warn("<<<<<<<<I HEARD THE EVENT!!");
    });

    return (
        <div ref={dragZoneRef} className="drag-zone">
            {tabs.map((tabId) => (
                <Tab key={tabId} id={tabId} dragHandler={dragHandler}>
                    <br />I am child element {tabId}
                </Tab>
            ))}
        </div>
    );
}

export default NewWindow;
