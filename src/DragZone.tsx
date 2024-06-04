import Tab from "./Tab.tsx";

import { warn } from "tauri-plugin-log-api";
import { window as tauriWindow } from "@tauri-apps/api";
import { PhysicalPosition, PhysicalSize, WebviewWindow, appWindow } from "@tauri-apps/api/window";

import { useEffect, useRef, useState } from "react";
import { dragAsWindow, onElementDrop, CallbackPayload, dragBack } from "./libs/drag-window.tsx";
import { emit, listen } from "@tauri-apps/api/event";

function DragZone({ defaultTabs }: { defaultTabs: string[] }) {
    const dragZoneRef = useRef<HTMLDivElement>(null);
    const windowLabel = appWindow.label;
    const isMounted = useRef(false);
    const [tabs, setTabs] = useState(defaultTabs);

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

    const checkCursorOnOtherWindows = async (cursorX: number, cursorY: number): Promise<[boolean, WebviewWindow | null]> => {
        // get all windows
        const windows: WebviewWindow[] = await tauriWindow.getAll();

        // print type of windows [0]
        console.log(windows);

        // loop through all windows
        for (const window of windows) {
            // if (window.label === appWindow.label) {
            // if window is the current window, skip
            // continue;
            // }
            // check if cursor is inside the window
            if (await checkCursorInsideWindow(window, cursorX, cursorY)) {
                return [true, window];
            }
        }
        return [false, null];
    };

    const createWindow = async (el: HTMLDivElement, payload: CallbackPayload) => {
        const newWindow = new WebviewWindow(el.id, {
            url: `/#/window/${el.id}`,
            title: `New Window ${el.id}`,
            width: el.clientWidth,
            height: el.clientHeight + 200, // 20: titlebar height
            x: (payload.cursorPos.x as number) - el.clientWidth / 2,
            y: (payload.cursorPos.y as number) - 20,
        });

        newWindow.once(`loaded-${el.id}`, async () => {
            warn("window loaded");
            newWindow.emit(`init-${el.id}`, {
                id: el.id,
            });
        });
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

                    warn("trying to create window");

                    // check if the cursor is on another window, and if true, return
                    const [res, resWindow] = await checkCursorOnOtherWindows(payload.cursorPos.x as number, payload.cursorPos.y as number);

                    if (res) {
                        // ignore case of cursor inside the current window, cause we don't want anything to happen
                        if (resWindow!.label == appWindow.label) {
                            warn("cursor is inside the current window");
                            return;
                        }

                        // in the case that the cursor is inside another window, we don't want to create a new window but instead
                        // just add a new element to that window
                        warn("cursor is inside window " + resWindow!.label);
                        warn(">>>> we are adding item to window " + resWindow!.label);
                        // loop through this:
                        await emit(`add-tab-${resWindow!.label}`, {
                            id: el.id,
                        });
                        removeTab(el.id);

                        return;
                    }
                    // if (await checkCursorOnOtherWindows(payload.cursorPos.x as number, payload.cursorPos.y as number)) {
                    //     warn("WARNING: cursor is inside the current or another window");
                    //     return;
                    // }

                    warn("cursor is outside the window");

                    // create window
                    await createWindow(el, payload);

                    el.remove();
                } catch (e) {
                    console.error(e);
                }
            });
        } catch (err) {
            console.error("failed to drag", err);
            warn("failed to drag");
        }

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


        // add dragging class
        el.classList.add("dragging");
    };

    const addTab = (id: string) => {
        warn("appendItem " + id);
        // append <Tab> to dropZoneRef with name id, dragHandler

        const newItemId = `${id}`;
        setTabs((prevTabs) => [...prevTabs, newItemId]);
    };

    const removeTab = (id: string) => {
        setTabs((prevTabs) => prevTabs.filter((tabId) => tabId !== id));
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

            listen(`init-${windowLabel}`, (event: any) => {
                addTab(event.payload.id);
            });

            emit(`loaded-${windowLabel}`, {
                window: windowLabel,
            });

        }
        const unlisten = listen<string>(`add-tab-${windowLabel}`, (event: { payload: any }) => {
            warn("<><><><><>  dropping item " + event.payload.id);
            addTab(event.payload.id);
        });

        return () => {
            // unlisten to events here
            unlisten.then((f) => f());

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
