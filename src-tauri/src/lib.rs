pub mod engine;

use crate::engine::grid::GridState;
use crate::engine::optimizer::Optimizer;
use tauri::State;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

struct AppState {
    grid: Mutex<GridState>,
    optimizer: Optimizer,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppData {
    pub facilities: Vec<crate::engine::facility::Facility>,
    pub items: Vec<crate::engine::item::Item>,
    pub recipes: Vec<crate::engine::recipe::Recipe>,
    pub config: serde_json::Value,
}

#[tauri::command]
fn get_app_data() -> AppData {
    AppData {
        facilities: crate::engine::data_loader::DataLoader::load_facilities(),
        items: crate::engine::data_loader::DataLoader::load_items(),
        recipes: crate::engine::data_loader::DataLoader::load_recipes(),
        config: crate::engine::data_loader::DataLoader::load_config(),
    }
}

#[tauri::command]
fn get_grid_state(state: State<'_, AppState>) -> GridState {
    let grid = state.grid.lock().unwrap();
    serde_json::from_str(&serde_json::to_string(&*grid).unwrap()).unwrap()
}

#[tauri::command]
fn update_simulation_state(
    state: State<'_, AppState>,
    facilities: Vec<crate::engine::facility::PlacedFacility>,
    edges: Vec<crate::engine::logistics::LogisticsEdge>,
) {
    let mut grid = state.grid.lock().unwrap();
    grid.placed_facilities = facilities;
    grid.logistics_edges = edges;
    // Rebuild occupancy if needed or other spatial indexes
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = crate::engine::data_loader::DataLoader::load_config();
    let optimizer = pollster::block_on(Optimizer::new());
    
    tauri::Builder::default()
        .manage(AppState {
            grid: Mutex::new(GridState::new(&config)),
            optimizer,
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_grid_state, get_app_data, update_simulation_state])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
