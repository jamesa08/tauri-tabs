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

        // print type of windows [0]
        console.log(windows);

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
                height: el.clientHeight + 200, // 20: titlebar height
                x: (payload.cursorPos.x as number) - el.clientWidth / 2,
                y: (payload.cursorPos.y as number) - 20,
            });
            warn("created window " + el.id + " with tabs " + tabs);

            warn("waiting for load: " + `loaded-${el.id}${rand}`);
            // use a promise to wait for the window to load, and only resolve it when the window event is loaded and we send data
            await new Promise<void>((resolve) => {
                newWindow.listen(`loaded-${el.id}${rand}`, () => {
                    warn("sending init " + `init-${el.id}${rand}`);
                    newWindow.emit(`init-${el.id}${rand}`, {
                        id: el.id,
                    });
                    resolve();
                });
            });
        } catch (e) {
            warn("error creating window " + e);
        }
    };

    const dragHandler = async (event: DragEvent) => {
        event.preventDefault();
        warn("dragging in drag handler on window " + windowLabel + " with tabs " + tabs);

        const el = event.target as HTMLDivElement;
        try {
            await dragAsWindow(el, async (payload: CallbackPayload) => {
                try {
                    // remove dragging class , aside: why is this behavior like this?
                    el.classList.remove("dragging");

                    warn("trying to create window on window " + windowLabel + " with tabs " + tabs + " and id " + el.id);

                    // check if the cursor is on another window, and if true, return
                    const [cursorOnOtherWindow, otherWindow] = await checkCursorOnOtherWindows(payload.cursorPos.x as number, payload.cursorPos.y as number);

                    if (cursorOnOtherWindow) {
                        // ignore case of cursor inside the current window, cause we don't want anything to happen
                        if (otherWindow!.label == appWindow.label) {
                            warn("cursor is inside the current window" + otherWindow!.label + " do nothing");
                            return;
                        }

                        // in the case that the cursor is inside another window, we don't want to create a new window but instead
                        // just add a new element to that window
                        warn("cursor is inside window " + otherWindow!.label);
                        warn("adding element into window " + otherWindow!.label + " with element: " + el.id);

                        await emit(`add-tab-${otherWindow!.label}`, {
                            id: el.id,
                        });

                        // remove the tab from the current window or just close it
                        if (tabs.length == 1) {
                            warn("closing window " + otherWindow!.label + " with element " + el.id);
                            if (appWindow.label != "main") {
                                await appWindow.close();
                            }
                        } else {
                            warn("removing tab of element:" + el.id);
                            removeTab(el.id);
                        }

                        return;
                    }

                    warn("cursor is outside the window");

                    // create window
                    await createWindow(el, payload);

                    // is the window empty? if so, close it
                    if (tabs.length == 1 && appWindow.label != "main") {
                        warn("closing window " + el.id + " " + tabs.length);
                        await appWindow.close(); // any code after this will not be executed (it is closed lol)
                    }
                    warn("done creating window");

                    removeTab(el.id);
                } catch (e) {
                    warn("something went wrong" + e);
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

        const newItemId = `${id}`;
        setTabs((prevTabs) => [...prevTabs, newItemId]);
    };

    const removeTab = (id: string) => {
        setTabs((prevTabs) => prevTabs.filter((tabId) => tabId != id));

        warn(">>>>>> TABS REPR IN WINDOW " + windowLabel + tabs.filter((tabId) => tabId !== id).toString());
        warn(">>>>>> tab length after remove " + tabs.length);
    };

    useEffect(() => {
        warn("UPDATE: tabs count " + tabs.length);

        const windows = tauriWindow.getAll();
        let windowLabels = windows.map((window) => window.label);
        warn("UPDATE: windows: " + windowLabels.toString());

        if (!isMounted.current) {
            // first time
            warn("React:Window " + windowLabel + " mounted");

            // onElementDrop((data) => {
            //     warn("onElementDrop " + data.id);
            //     addTab(data.id);
            // });

            listen(`init-${windowLabel}`, (event: any) => {
                warn("init " + `init-${windowLabel}` + " event received on " + windowLabel + " with id " + event.payload.id);
                addTab(event.payload.id);
            });

            warn("emitting loaded-" + windowLabel);
            emit(`loaded-${windowLabel}`, {
                window: windowLabel,
            });
            isMounted.current = true;
        }
        const addTabListener = listen<string>(`add-tab-${windowLabel}`, (event: { payload: any }) => {
            warn("tab is being added to " + windowLabel + " with id " + event.payload.id);
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
