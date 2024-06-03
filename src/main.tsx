import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HashRouter as Router, Route, Routes }  from "react-router-dom";
import NewWindow from "./NewWindow";
import { attachConsole } from "tauri-plugin-log-api";

attachConsole();  // attach Tauri dev console

import { event, process } from "@tauri-apps/api";

event.listen('tauri://update-available', function () {
  process.relaunch();
});


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <Router>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/window/:id" element={<NewWindow />} />
            </Routes>
        </Router>
    </React.StrictMode>
);
