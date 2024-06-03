import Tab from "./Tab.tsx";

import { warn } from "tauri-plugin-log-api";
import { PhysicalPosition, PhysicalSize, WebviewWindow, appWindow } from "@tauri-apps/api/window";

import { DragEventHandler, useEffect, useRef, useState } from "react";
import { dragAsWindow, onElementDrop, CallbackPayload } from "./libs/drag-window.tsx";
import { redirect } from "react-router-dom";

// const initState = {
//     data: [],
// };

// const getInitialState = () => {
//     const state = localStorage.getItem("data");
//     return state ? JSON.parse(state) : initState;
// };

function DragZone() {
    const isMounted = useRef(false);
    const dragZoneRef = useRef<HTMLDivElement>(null);
    const [tabs, setTabs] = useState(["1", "2", "3"]);

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

    const createWindowByHtmlTemplate = async (el: HTMLDivElement, payload: CallbackPayload) => {
        const newWindow = new WebviewWindow(el.id, {
            url: `/#/window/${el.id}`,
            title: `New Window ${el.id}`,
            width: el.clientWidth,
            height: el.clientHeight + 40, // 20: titlebar height
            x: (payload.cursorPos.x as number) - el.clientWidth / 2,
            y: (payload.cursorPos.y as number) - 20,
        });

        newWindow.once(`loaded-${el.id}`, async () => {
            warn("window loaded");
            newWindow.emit(`init-${el.id}`, {
                id: el.id,
            });
        });

        // redirect(`/#/window/${el.id}`);
    };

    const onDragStartNew = (event: any) => {
        event.preventDefault();
        event.stopPropagation();
        const droppedData = event.dataTransfer.getData("text/plain");
        warn("droppedData ", droppedData);
    };

    const dragHandler = async (event: DragEvent) => {
        event.preventDefault();
        warn("dragging in drag handler");

        const el = event.target as HTMLDivElement;
        try {
            await dragAsWindow(el, async (payload: CallbackPayload) => {
                try {
                    // remove dragging class , aside: why is this behavior like this?
                    el.classList.remove("dragging");

                    warn("creating window");

                    // only create window if the drag was outside of the drop zone
                    // call the function in dragHandler
                    if (await checkCursorInsideWindow(appWindow, payload.cursorPos.x as number, payload.cursorPos.y as number)) {
                        return;
                    }

                    warn("cursor is outside the window");

                    // create window
                    await createWindowByHtmlTemplate(el, payload);

                    el.remove();
                } catch (e) {
                    console.error(e);
                }
            });
        } catch (err) {
            console.error("failed to drag", err);
            warn("failed to drag");
        }

        // add dragging class
        el.classList.add("dragging");
    };

    const addTab = (id: string) => {
        warn("appendItem " + id);
        // append <Tab> to dropZoneRef with name id, dragHandler

        const newItemId = `tab${id}`; // Generate a unique ID for the new item
        setTabs((prevTabs) => [...prevTabs, newItemId]);
    };

    // ignore type error

    useEffect(() => {
        if (!isMounted.current) {
            // first time
            isMounted.current = true;
            warn("Hello I am from DragZone, this is the first time running!");
            
            onElementDrop((data) => {
                warn("onElementDrop " + data.id);
                addTab(data.id);
            });
        }

        return () => {
            // unlisten to events here
        };
    }, []);

    return (
        <div ref={dragZoneRef} className="drag-zone">
            {/* create tabs by updating state */}
            {tabs.map((tabId) => (
                <Tab key={tabId} id={tabId} dragHandler={dragHandler}>
                    <br />I am child element {tabId}
                </Tab>
            ))}
        </div>
    );
}

export default DragZone;
