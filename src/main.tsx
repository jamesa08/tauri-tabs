import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HashRouter as Router, Route, Routes }  from "react-router-dom";
import { attachConsole } from "tauri-plugin-log-api";
import DragZone from "./DragZone";

attachConsole();  // attach Tauri dev console

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <Router>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/window/:id" element={<DragZone defaultTabs={[] as string[]} />} />
            </Routes>
        </Router>
    </React.StrictMode>
);
