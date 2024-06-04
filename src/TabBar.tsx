import Tab from "./Tab.tsx";

import { warn } from "tauri-plugin-log-api";
import { window as tauriWindow } from "@tauri-apps/api";
import { PhysicalPosition, PhysicalSize, WebviewWindow, appWindow } from "@tauri-apps/api/window";

import { useEffect, useRef, useState } from "react";
import { dragAsWindow, CallbackPayload } from "./libs/drag-window.tsx";
import { emit, listen } from "@tauri-apps/api/event";

function TabBar({ defaultTabs }: { defaultTabs: string[] }) {
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

        // if cursor is inside the window, return
        if (cursorX >= windowLeft && cursorX <= windowRight && cursorY >= windowTop && cursorY <= windowBottom) {
            return true;
        }

        return false;
    };

    const checkCursorOnOtherWindows = async (cursorX: number, cursorY: number): Promise<[boolean, WebviewWindow | null]> => {
        // get all windows
        const windows: WebviewWindow[] = await tauriWindow.getAll();
        // loop through all windows
        for (const window of windows) {
            // check if cursor is inside the window
            if (await checkCursorInsideWindow(window, cursorX, cursorY)) {
                return [true, window];
            }
        }
        return [false, null];
    };

    const createWindow = async (el: HTMLDivElement, payload: CallbackPayload) => {
        try {
            const rand = Date.now();
            const newWindow = new WebviewWindow(`${el.id}${rand}`, {
                url: `/#/window/${el.id}${rand}`,
                title: `New Window ${el.id}`,
                width: el.clientWidth,
                height: el.clientHeight + 200,
                x: (payload.cursorPos.x as number) - el.clientWidth / 2,
                y: (payload.cursorPos.y as number) - 20,
            });

            // use a promise to wait for the window to load, and only resolve it when the window event is loaded and we send data
            await new Promise<void>((resolve) => {
                newWindow.listen(`loaded-${el.id}${rand}`, () => {
                    newWindow.emit(`init-${el.id}${rand}`, {
                        id: el.id,
                    });
                    resolve();
                });
            });
        } catch (e) {
            warn("error occured while creating window: " + e);
        }
    };

    const dragHandler = async (event: DragEvent) => {
        event.preventDefault();

        const el = event.target as HTMLDivElement;
        try {
            await dragAsWindow(el, async (payload: CallbackPayload) => {
                try {
                    // remove dragging class , aside: why is this behavior like this?
                    el.classList.remove("dragging");

                    // check if the cursor is on another window, and if true, return
                    const [cursorOnOtherWindow, otherWindow] = await checkCursorOnOtherWindows(payload.cursorPos.x as number, payload.cursorPos.y as number);

                    if (cursorOnOtherWindow) {
                        // ignore case of cursor inside the current window, cause we don't want anything to happen
                        if (otherWindow!.label == appWindow.label) {
                            return;
                        }

                        // in the case that the cursor is inside another window, we don't want to create a new window but instead
                        // just add a new element to that window
                        await emit(`add-tab-${otherWindow!.label}`, {
                            id: el.id,
                        });

                        // only close window if its not the main window and there are (going to be) no tabs
                        if (tabs.length == 1 && appWindow.label != "main") {
                            await appWindow.close();
                        }
                        removeTab(el.id);

                        return;
                    }

                    // create window
                    await createWindow(el, payload);

                    // is the window empty? if so, close it
                    if (tabs.length == 1 && appWindow.label != "main") {
                        await appWindow.close(); // any code after this will not be executed (it is closed lol)
                    }

                    removeTab(el.id);
                } catch (e) {
                    warn("error occured while dragging: " + e);
                }
            });
        } catch (err) {
            warn("failed to drag: " + err);
        }

        // add dragging class
        el.classList.add("dragging");
    };

    const addTab = (id: string) => {
        // append <Tab> to dropZoneRef with name id, dragHandler

        const newItemId = `${id}`;
        setTabs((prevTabs) => [...prevTabs, newItemId]);
    };

    const removeTab = (id: string) => {
        setTabs((prevTabs) => prevTabs.filter((tabId) => tabId != id));
    };

    useEffect(() => {
        if (!isMounted.current) {
            // first time mounting
            listen(`init-${windowLabel}`, (event: any) => {
                addTab(event.payload.id);
            });

            emit(`loaded-${windowLabel}`, {
                window: windowLabel,
            });
            isMounted.current = true;
        }
        const addTabListener = listen<string>(`add-tab-${windowLabel}`, (event: { payload: any }) => {
            addTab(event.payload.id);
        });

        return () => {
            // unlisten to events here
            addTabListener.then((f) => f());
        };
    }, [tabs]);

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

export default TabBar;
