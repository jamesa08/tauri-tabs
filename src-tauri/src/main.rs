#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
use tauri_plugin_log::{fern::colors::ColoredLevelConfig, LogTarget};
use log::LevelFilter;


fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_drag_as_window::init())
        .plugin(
            tauri_plugin_log::Builder::default().targets([
                LogTarget::Stdout,
                LogTarget::Webview,
            ])
            .with_colors(ColoredLevelConfig::default())
           .level(LevelFilter::Warn)
            .build()
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}