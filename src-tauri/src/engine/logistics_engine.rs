use crate::engine::grid::GridState;
use crate::engine::facility::{BufferSlot, PlacedFacility};
use std::collections::HashMap;

pub struct LogisticsEngine;

impl LogisticsEngine {
    pub fn tick(grid: &mut GridState, dt: f64) {
        if !grid.logistics_edges.is_empty() {
             // println!("DEBUG: Logistics Engine Tick. Edges: {}", grid.logistics_edges.len());
        }
        
        // 1. Universal Provider Logic (Slower Cadence)
        for facility in &mut grid.placed_facilities {
            if let Some(settings) = &facility.port_settings {
                for setting in settings {
                    let has_connection = grid.logistics_edges.iter().any(|e| 
                        e.from_instance_id == facility.instance_id && e.from_port_id == setting.port_id
                    );

                    if has_connection {
                        // Check if we can spawn (spacing)
                        let can_spawn = !facility.output_buffer.iter().any(|s| 
                            s.target_port_id.as_ref() == Some(&setting.port_id) && s.progress < 0.35
                        );
                        
                        if can_spawn {
                            facility.output_buffer.push(BufferSlot {
                                item_id: setting.item_id.clone(),
                                source_port_id: Some(setting.port_id.clone()),
                                target_port_id: Some(setting.port_id.clone()),
                                quantity: 1,
                                progress: 1.0, 
                            });
                        }
                    }
                }
            }
        }

        // 2. Progress and Transfer Pass
        for facility in &mut grid.placed_facilities {
            for slot in &mut facility.output_buffer {
                if slot.progress < 1.0 {
                    let old_progress = slot.progress;
                    // Slower speed: 1.0 units per second (as requested)
                    slot.progress += dt * 1.0; 
                    if slot.progress > 1.0 { slot.progress = 1.0; }
                    
                    if old_progress < 0.5 && slot.progress >= 0.5 {
                        println!("[Logistics] Moving: Item {} in {} is mid-way ({:.2})", slot.item_id, facility.instance_id, slot.progress);
                    }
                    if slot.progress >= 1.0 && old_progress < 1.0 {
                        println!("[GOAL] MOVE: Item {} in {} reached end of segment", slot.item_id, facility.instance_id);
                    }
                }
            }
        }

        let facility_indices: HashMap<String, usize> = grid.placed_facilities
            .iter()
            .enumerate()
            .map(|(i, f)| (f.instance_id.clone(), i))
            .collect();

        let mut transfers: Vec<(usize, usize, String, String, BufferSlot)> = Vec::new(); 

        for edge in &grid.logistics_edges {
            if let (Some(&from_idx), Some(&to_idx)) = (
                facility_indices.get(&edge.from_instance_id),
                facility_indices.get(&edge.to_instance_id)
            ) {
                let from_facility = &grid.placed_facilities[from_idx];
                
                // Check all items in output_buffer for this port
                for item in &from_facility.output_buffer {
                    if item.target_port_id.as_ref() == Some(&edge.from_port_id) && item.progress >= 1.0 {
                        let to_facility = &grid.placed_facilities[to_idx];
                        // Allow larger input buffer to handle queues (e.g. 10 items)
                        if to_facility.input_buffer.len() < 10 {
                            transfers.push((from_idx, to_idx, edge.from_port_id.clone(), edge.to_port_id.clone(), item.clone()));
                            break; // One transfer per edge per tick
                        }
                    }
                }
            }
        }

        for (from_idx, to_idx, from_port, to_port, item) in transfers {
            if from_idx == to_idx { continue; }
            
            let (small_idx, large_idx) = if from_idx < to_idx { (from_idx, to_idx) } else { (to_idx, from_idx) };
            let (left, right) = grid.placed_facilities.split_at_mut(large_idx);
            let first = &mut left[small_idx];
            let second = &mut right[0];
            
            let (from_fac, to_fac) = if from_idx < to_idx { (first, second) } else { (second, first) };
            
            // Re-find the item to remove it
            if let Some(pos) = from_fac.output_buffer.iter().position(|s| s.target_port_id.as_ref() == Some(&from_port) && s.item_id == item.item_id) {
                // Check Capacity of destination input buffer
                // For now, we count total items in input_buffer or items of same type
                let current_count: u32 = to_fac.input_buffer.iter().filter(|s| s.item_id == item.item_id).map(|s| s.quantity).sum();
                let max_capacity: u32 = 50; // Should ideally come from config, but using 50 as requested/default

                if current_count < max_capacity {
                    let mut moved_item = from_fac.output_buffer.remove(pos);
                    // On transfer, the source is the port it just entered
                    moved_item.progress = 0.0;
                    moved_item.source_port_id = Some(to_port.clone());
                    moved_item.target_port_id = None; 
                    to_fac.input_buffer.push(moved_item);
                    println!("[GOAL] TRANSFER: Item {} from {} (Port {}) arrived at {} (Port {})", 
                        item.item_id, from_fac.instance_id, from_port, to_fac.instance_id, to_port);
                }
            }
        }
        
        // 3. Process Belt Items (Internal Logic: IN -> OUT)
        let geometry = crate::engine::data_loader::DataLoader::load_geometry();
        for facility in &mut grid.placed_facilities {
            if facility.input_buffer.is_empty() { continue; }

            let is_belt = facility.facility_id.to_lowercase().contains("belt");

            if is_belt {
                // Belt Spacing Logic: Only take if there's space on the belt
                let can_take = if let Some(last_item) = facility.output_buffer.last() {
                    last_item.progress > 0.33 // 0.33 progress spacing (3 items per grid)
                } else {
                    true
                };

                if can_take && facility.output_buffer.len() < 3 {
                    let mut item = facility.input_buffer.remove(0);
                    if let Some(meta) = geometry.as_array().and_then(|a| a.iter().find(|f| f["id"] == facility.facility_id)) {
                        if let Some(ports) = meta["ports"].as_array() {
                            if let Some(out_port) = ports.iter().find(|p| p["type"] == "output") {
                                let out_id = out_port["id"].as_str().map(|s| s.to_string());
                                item.source_port_id = out_id.clone();
                                item.target_port_id = out_id;
                                item.progress = 0.0; // Start at port entry
                                println!("[Logistics] Processing: Item {} entered belt {}", item.item_id, facility.instance_id);
                                facility.output_buffer.push(item);
                            }
                        }
                    }
                }
            } else {
                // Machine Logic: Teleport to output instantly (Remove internal animation)
                if facility.output_buffer.is_empty() {
                    let mut item = facility.input_buffer.remove(0);
                    if let Some(meta) = geometry.as_array().and_then(|a| a.iter().find(|f| f["id"] == facility.facility_id)) {
                        if let Some(ports) = meta["ports"].as_array() {
                            if let Some(out_port) = ports.iter().find(|p| p["type"] == "output") {
                                let out_id = out_port["id"].as_str().map(|s| s.to_string());
                                item.source_port_id = out_id.clone();
                                item.target_port_id = out_id;
                                item.progress = 1.0; // Instant teleport
                                println!("[GOAL] PROCESS: Item {} finished processing in facility {}", item.item_id, facility.instance_id);
                                facility.output_buffer.push(item);
                            }
                        }
                    }
                }
            }
        }

    }
}
