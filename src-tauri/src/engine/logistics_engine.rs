use crate::engine::grid::GridState;
use crate::engine::facility::BufferSlot;
use std::collections::HashMap;

pub struct LogisticsEngine;

impl LogisticsEngine {
    pub fn tick(grid: &mut GridState, dt: f64, recipes: &Vec<crate::engine::recipe::Recipe>) {
        if !grid.logistics_edges.is_empty() {
             // println!("DEBUG: Logistics Engine Tick. Edges: {}", grid.logistics_edges.len());
        }
        
        let geometry = crate::engine::data_loader::DataLoader::load_geometry();
        let flow_rate = geometry["config"]["logistics_flow_rate_units_per_s"].as_f64().unwrap_or(0.5);
        
        // 1. Universal Provider Logic (Spawns items into Machine Output Buffer)
        for facility in &mut grid.placed_facilities {
            if let Some(settings) = &facility.port_settings {
                for setting in settings {
                    let has_connection = grid.logistics_edges.iter().any(|e| 
                        e.from_instance_id == facility.instance_id && e.from_port_id == setting.port_id
                    );

                    if has_connection {
                        // Spacing check: allow 2 items per grid (spacing 0.5)
                        // New item can spawn if the previous one is at least halfway (0.5 progress)
                        let can_spawn = !facility.output_buffer.iter().any(|s| 
                            s.source_port_id.as_ref() == Some(&setting.port_id) && s.progress < 0.5
                        );
                        
                        if can_spawn {
                            facility.output_buffer.push(BufferSlot {
                                item_id: setting.item_id.clone(),
                                source_port_id: Some(setting.port_id.clone()),
                                target_port_id: Some(setting.port_id.clone()),
                                quantity: 1,
                                progress: 0.0,
                            });
                        }
                    }
                }
            }
        }

        // 2. Dynamic Progress Update (60FPS Smooth Movement)
        for facility in &mut grid.placed_facilities {
            for slot in &mut facility.input_buffer {
                if slot.progress < 1.0 && !slot.item_id.is_empty() {
                    slot.progress += dt * flow_rate;
                    if slot.progress > 1.0 { slot.progress = 1.0; }
                }
            }
            for slot in &mut facility.output_buffer {
                if slot.progress < 1.0 {
                    slot.progress += dt * flow_rate;
                    if slot.progress > 1.0 { slot.progress = 1.0; }
                }
            }
        }

        let facility_indices: HashMap<String, usize> = grid.placed_facilities
            .iter()
            .enumerate()
            .map(|(i, f)| (f.instance_id.clone(), i))
            .collect();

        // 3. Smooth Transfer Pass (Between Facilities)
        let mut transfers: Vec<(usize, usize, String, String, BufferSlot)> = Vec::new(); 
        for edge in &grid.logistics_edges {
            if let (Some(&from_idx), Some(&to_idx)) = (
                facility_indices.get(&edge.from_instance_id),
                facility_indices.get(&edge.to_instance_id)
            ) {
                let from_facility = &grid.placed_facilities[from_idx];
                let from_meta = geometry.as_array().and_then(|a| a.iter().find(|f| f["id"] == from_facility.facility_id));
                let from_is_logistics = from_meta.and_then(|m| m["category"].as_str()).map(|c| c == "logistics").unwrap_or(false);
                
                let source_buffer = if from_is_logistics { &from_facility.input_buffer } else { &from_facility.output_buffer };

                for item in source_buffer {
                    if item.progress >= 1.0 && !item.item_id.is_empty() {
                        let to_facility = &grid.placed_facilities[to_idx];
                        // Spacing Check: Allow transfer if target has space for 0.5 density
                        let target_is_clear = !to_facility.input_buffer.iter().any(|s| s.progress < 0.5);
                        
                        if target_is_clear && to_facility.input_buffer.len() < 10 {
                            transfers.push((from_idx, to_idx, edge.from_port_id.clone(), edge.to_port_id.clone(), item.clone()));
                            break; 
                        }
                    }
                }
            }
        }

        for (from_idx, to_idx, _from_port, to_port, item) in transfers {
            if from_idx == to_idx { continue; }
            let (small_idx, large_idx) = if from_idx < to_idx { (from_idx, to_idx) } else { (to_idx, from_idx) };
            let (left, right) = grid.placed_facilities.split_at_mut(large_idx);
            let first = &mut left[small_idx];
            let second = &mut right[0];
            let (from_fac, to_fac) = if from_idx < to_idx { (first, second) } else { (second, first) };
            
            let from_meta = geometry.as_array().and_then(|a| a.iter().find(|f| f["id"] == from_fac.facility_id));
            let from_is_logistics = from_meta.and_then(|m| m["category"].as_str()).map(|c| c == "logistics").unwrap_or(false);
            let source_buffer = if from_is_logistics { &mut from_fac.input_buffer } else { &mut from_fac.output_buffer };

            if let Some(pos) = source_buffer.iter().position(|s| s.item_id == item.item_id && s.progress >= 1.0) {
                 let mut moved_item = source_buffer.remove(pos);
                 moved_item.progress = 0.0; // Reset for next grid segment
                 moved_item.source_port_id = Some(to_port.clone());
                 moved_item.target_port_id = None; 
                 to_fac.input_buffer.push(moved_item);
            }
        }
        
        // 4. Internal Processing (Assignments)
        for facility in &mut grid.placed_facilities {
            let facility_meta = geometry.as_array().and_then(|a| a.iter().find(|f| f["id"] == facility.facility_id));
            let is_logistics = facility_meta.and_then(|m| m["category"].as_str()).map(|c| c == "logistics").unwrap_or(false);

            if is_logistics {
                for slot in &mut facility.input_buffer {
                    if slot.target_port_id.is_none() {
                        if let Some(ports) = facility_meta.and_then(|m| m["ports"].as_array()) {
                            if let Some(out_port) = ports.iter().find(|p| p["type"] == "output") {
                                slot.target_port_id = out_port["id"].as_str().map(|s| s.to_string());
                            }
                        }
                    }
                }
            } else {
                // Machine/Facility Logic
                
                // Identify if there are any recipes for this facility
                let facility_recipes: Vec<&crate::engine::recipe::Recipe> = recipes.iter()
                    .filter(|r| r.facility_id == facility.facility_id)
                    .collect();

                if !facility_recipes.is_empty() {
                    // RECIPE LOGIC
                    
                    // 1. Check if we need to start a new recipe
                    if facility.active_recipe_id.is_none() {
                         for recipe in &facility_recipes {
                            // Check inputs
                            let mut satisfied = true;
                            for input in &recipe.inputs {
                                let total_qty: u32 = facility.input_buffer.iter()
                                    .filter(|s| s.item_id == input.item_id)
                                    .map(|s| s.quantity)
                                    .sum();
                                if (total_qty as f32) < input.amount {
                                    satisfied = false;
                                    break;
                                }
                            }

                            if satisfied {
                                // Consume inputs
                                for input in &recipe.inputs {
                                    let mut needed = input.amount as u32;
                                    while needed > 0 {
                                        if let Some(pos) = facility.input_buffer.iter().position(|s| s.item_id == input.item_id && s.quantity > 0) {
                                            if facility.input_buffer[pos].quantity > needed {
                                                facility.input_buffer[pos].quantity -= needed;
                                                needed = 0;
                                            } else {
                                                needed -= facility.input_buffer[pos].quantity;
                                                facility.input_buffer[pos].quantity = 0;
                                                facility.input_buffer[pos].item_id = "".to_string();
                                            }
                                        } else {
                                            break; 
                                        }
                                    }
                                }
                                
                                // Start Recipe
                                facility.active_recipe_id = Some(recipe.id.clone());
                                facility.recipe_progress = 0.0;
                                println!("[Logistics] Recipe Started: {} in {}", recipe.id, facility.instance_id);
                                break; // Start only one
                            }
                         }
                    }

                    // 2. Process active recipe
                    if let Some(recipe_id) = &facility.active_recipe_id.clone() {
                         if let Some(recipe) = recipes.iter().find(|r| r.id == *recipe_id) {
                             facility.recipe_progress += dt;
                             
                             // Check completion
                             if facility.recipe_progress >= recipe.crafting_time as f64 {
                                 // Determine output port (first output port found)
                                 let mut out_port_id: Option<String> = None;
                                 if let Some(meta) = geometry.as_array().and_then(|a| a.iter().find(|f| f["id"] == facility.facility_id)) {
                                     if let Some(ports) = meta["ports"].as_array() {
                                         if let Some(out_port) = ports.iter().find(|p| p["type"] == "output") {
                                             out_port_id = out_port["id"].as_str().map(|s| s.to_string());
                                         }
                                     }
                                 }

                                 // Produce Outputs
                                 for output in &recipe.outputs {
                                     facility.output_buffer.push(BufferSlot {
                                         item_id: output.item_id.clone(),
                                         quantity: output.amount as u32,
                                         source_port_id: out_port_id.clone(),
                                         target_port_id: out_port_id.clone(),
                                         progress: 1.0, // Instantly at output port
                                     });
                                 }
                                 
                                 println!("[Logistics] Recipe Finished: {} in {}", recipe.id, facility.instance_id);
                                 facility.active_recipe_id = None;
                                 facility.recipe_progress = 0.0;
                             }
                         } else {
                             // Recipe ID invalid
                             facility.active_recipe_id = None;
                         }
                    }

                }
            }
        }

    }

}
