pub mod engine;

use crate::engine::grid::GridState;
use crate::engine::optimizer::Optimizer;
use tauri::State;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

struct AppState {
    grid: Mutex<GridState>,
    optimizer: Option<Optimizer>,
    recipes: Vec<crate::engine::recipe::Recipe>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppData {
    pub facilities: Vec<crate::engine::facility::Facility>,
    pub items: Vec<crate::engine::item::Item>,
    pub recipes: Vec<crate::engine::recipe::Recipe>,
    pub config: serde_json::Value,
    pub geometry: serde_json::Value,
}

#[tauri::command]
fn get_app_data() -> AppData {
    println!("DEBUG: get_app_data called");
    let data = AppData {
        facilities: crate::engine::data_loader::DataLoader::load_facilities(),
        items: crate::engine::data_loader::DataLoader::load_items(),
        recipes: crate::engine::data_loader::DataLoader::load_recipes(),
        config: crate::engine::data_loader::DataLoader::load_config(),
        geometry: crate::engine::data_loader::DataLoader::load_geometry(),
    };
    println!("DEBUG: Config loaded: {:?}", data.config);
    println!("DEBUG: Geometry items: {}", data.geometry.as_array().map_or(0, |a| a.len()));
    data
}

#[tauri::command]
fn get_grid_state(state: State<'_, AppState>) -> GridState {
    println!("DEBUG: get_grid_state called");
    let grid = state.grid.lock().unwrap();
    serde_json::from_str(&serde_json::to_string(&*grid).unwrap()).unwrap()
}

#[tauri::command]
fn update_simulation_state(
    state: State<'_, AppState>,
    facilities: Vec<crate::engine::facility::PlacedFacility>,
    edges: Vec<crate::engine::logistics::LogisticsEdge>,
) {
    println!("DEBUG: update_simulation_state called with {} facilities", facilities.len());
    let mut grid = state.grid.lock().unwrap();
    grid.placed_facilities = facilities;
    grid.logistics_edges = edges;
    
    // Recalculate power grid
    let geometry = crate::engine::data_loader::DataLoader::load_geometry();
    grid.update_power_grid(&geometry);
}

#[tauri::command]
fn get_power_status(state: State<'_, AppState>) -> serde_json::Value {
    // Silent for polling but useful for initial debug
    // println!("DEBUG: get_power_status called");
    let grid = state.grid.lock().unwrap();
    serde_json::json!({
        "total_generation": grid.power_grid.total_generation,
        "total_consumption": grid.power_grid.total_consumption,
        "power_balance": grid.power_grid.get_power_balance(),
        "powered_count": grid.power_grid.powered_facilities.len(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
struct GenerateLayoutsRequest {
    target_items: Vec<(String, f64)>, // (item_id, rate_per_minute)
    plate_width: i32,
    plate_height: i32,
    num_candidates: usize,
}

#[tauri::command]
fn generate_optimal_layouts(request: GenerateLayoutsRequest) -> Result<Vec<crate::engine::layout_generator::LayoutCandidate>, String> {
    println!("DEBUG: generate_optimal_layouts called for {} target items", request.target_items.len());
    
    // Load data
    let facilities_vec = crate::engine::data_loader::DataLoader::load_facilities();
    let recipes_vec = crate::engine::data_loader::DataLoader::load_recipes();
    let geometry = crate::engine::data_loader::DataLoader::load_geometry();
    
    // Build facilities map
    let mut facilities_map = std::collections::HashMap::new();
    for facility in facilities_vec {
        facilities_map.insert(facility.id.clone(), facility);
    }
    
    // Convert recipes to solver format
    let solver_recipes: Vec<crate::engine::recipe_solver::Recipe> = recipes_vec.iter().map(|r| {
        crate::engine::recipe_solver::Recipe {
            id: r.id.clone(),
            name: r.name.clone(),
            inputs: r.inputs.iter().map(|i| crate::engine::recipe_solver::RecipeInput {
                item_id: i.item_id.clone(),
                amount: i.amount as f64,
            }).collect(),
            outputs: r.outputs.iter().map(|o| crate::engine::recipe_solver::RecipeOutput {
                item_id: o.item_id.clone(),
                amount: o.amount as f64,
            }).collect(),
            facility_id: r.facility_id.clone(),
            crafting_time: r.crafting_time as f64,
        }
    }).collect();
    
    // Solve for requirements
    let solver = crate::engine::recipe_solver::RecipeSolver::new(solver_recipes, facilities_map);
    let plan = solver.solve(
        request.target_items.clone(),
        request.plate_width,
        request.plate_height,
    ).map_err(|e| e.to_string())?;

    println!("DEBUG: Plan generated. Power: {}, Limited: {}", plan.total_power, plan.constraint_limited);
    println!("DEBUG: Production plan requires {} facility types", plan.required_facilities.len());
    
    // Generate layouts - Note: PAC is now handled automatically in layout_generator
    let constraints = crate::engine::layout_generator::LayoutConstraints {
        plate_width: request.plate_width,
        plate_height: request.plate_height,
        power_source_type: "pac".to_string(), // Consistently use 'pac'
        power_source_x: 0, // Will be set by generator
        power_source_y: 0, // Will be set by generator
        max_power_budget: None,
    };
    
    let generator = crate::engine::layout_generator::LayoutGenerator::new(constraints, geometry);
    
    let required_facilities: Vec<(String, String, f64)> = plan.required_facilities.iter()
        .map(|req| (req.facility_id.clone(), req.facility_type.clone(), req.count))
        .collect();
    
    // Use actual rates from plan (potentially constrained)
    let actual_target_items: Vec<(String, f64)> = plan.actual_rates.iter()
        .map(|(k, v)| (k.clone(), *v))
        .collect();

    let mut candidates = generator.generate_layouts(
        required_facilities,
        &actual_target_items,
        request.num_candidates,
    );
    
    // Attach constraint info
    for candidate in &mut candidates {
        candidate.limiting_factor = plan.limiting_factor.clone();
    }

    println!("DEBUG: Generator returned {} candidates", candidates.len());
    
    // Take top 5
    candidates.truncate(5);
    
    if candidates.is_empty() {
        return Err("No valid layouts could be generated within the given constraints. Try a larger board.".to_string());
    }
    
    println!("DEBUG: Generated {} layout candidates", candidates.len());
    
    Ok(candidates)
}

#[tauri::command]
fn update_config(config: serde_json::Value) {
    println!("DEBUG: update_config called");
    crate::engine::data_loader::DataLoader::update_config(config);
}

#[tauri::command]
fn log_to_terminal(msg: String) {
    println!("[Frontend]: {}", msg);
}

#[tauri::command]
fn tick_simulation(state: State<'_, AppState>) -> Vec<crate::engine::facility::PlacedFacility> {
    // println!("DEBUG: tick_simulation called");
    let mut grid = state.grid.lock().unwrap();
    
    // Run simulation tick (Fixed 50ms intervals)
    crate::engine::logistics_engine::LogisticsEngine::tick(&mut grid, &state.recipes);
    
    // Return updated state immediately for frontend sync
    grid.placed_facilities.clone()
}

#[tauri::command]
fn manual_inject_item(state: State<'_, AppState>, instance_id: String, slot_index: usize, item_id: String, quantity: u32) -> Result<String, String> {
    println!("DEBUG: manual_inject_item called: {} x{} -> {} [Slot {}]", item_id, quantity, instance_id, slot_index);
    let mut grid = state.grid.lock().unwrap();
    
    if let Some(fac) = grid.placed_facilities.iter_mut().find(|f| f.instance_id == instance_id) {
        // Ensure buffer size covers the requested slot
        while fac.input_buffer.len() <= slot_index {
            fac.input_buffer.push(crate::engine::facility::BufferSlot {
                item_id: "".to_string(), // Empty placeholder
                quantity: 0,
                source_port_id: None,
                target_port_id: None, 
            });
        }
        
        // Overwrite standard slot data logic: direct injection implies filling the slot
        fac.input_buffer[slot_index] = crate::engine::facility::BufferSlot {
            item_id: item_id.clone(),
            quantity,
            source_port_id: None,
            target_port_id: None,
        };
        
        println!("DEBUG: Injected {} into slot {}", item_id, slot_index);
        return Ok(format!("Successfully injected {} into slot {}", item_id, slot_index));
    }
    
    Err(format!("Facility {} not found", instance_id))
}

#[tauri::command]
fn manual_clear_slot(state: State<'_, AppState>, instance_id: String, slot_index: usize) -> Result<String, String> {
    let mut grid = state.grid.lock().unwrap();
    if let Some(fac) = grid.placed_facilities.iter_mut().find(|f| f.instance_id == instance_id) {
        if slot_index < fac.input_buffer.len() {
            fac.input_buffer[slot_index].item_id = "".to_string();
            fac.input_buffer[slot_index].quantity = 0;
            println!("DEBUG: Cleared slot {}", slot_index);
            return Ok("Slot cleared".to_string());
        }
    }
    Ok("Slot empty or invalid index".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("DEBUG: Starting Endfield lib run()");
    let config = crate::engine::data_loader::DataLoader::load_config();
    let recipes = crate::engine::data_loader::DataLoader::load_recipes(); // Load recipes here
    println!("DEBUG: Config loaded in run(): {:?}", config);
    println!("DEBUG: Loaded {} recipes", recipes.len());
    
    println!("DEBUG: Initializing Optimizer (WGPU) - Optional -- DISABLED FOR DEBUGGING");
    // let optimizer = pollster::block_on(Optimizer::new());
    let optimizer: Option<Optimizer> = None;
    if optimizer.is_some() {
        println!("DEBUG: Optimizer initialized successfully");
    } else {
        println!("DEBUG: Optimizer initialization skipped (Debugging)");
    }
    
    tauri::Builder::default()
        .manage(AppState {
            grid: Mutex::new(GridState::new(&config)),
            optimizer,
            recipes,
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            update_config, 
            get_grid_state, 
            get_app_data, 
            update_simulation_state, 
            get_power_status, 
            generate_optimal_layouts, 
            log_to_terminal,
            tick_simulation,
            manual_inject_item,
            manual_clear_slot // NEW COMMAND
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
