pub mod commands;
pub mod models;

use commands::{churn, coupling, hotspots, loc, ownership};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            loc::analyze_loc,
            hotspots::analyze_hotspots,
            churn::analyze_churn,
            coupling::analyze_coupling,
            ownership::analyze_ownership,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
