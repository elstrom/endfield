use crate::engine::grid::GridState;
use crate::engine::facility::BufferSlot;
use std::collections::HashMap;

pub struct LogisticsEngine;

impl LogisticsEngine {
    pub fn tick(grid: &mut GridState, recipes: &Vec<crate::engine::recipe::Recipe>) {
        if !grid.logistics_edges.is_empty() {
             println!("DEBUG: Logistics Engine Tick. Edges: {}", grid.logistics_edges.len());
        }
        
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();

        // 4. Internal Processing (Machines & Facilities)
        for facility in &mut grid.placed_facilities {
            let facility_recipes: Vec<&crate::engine::recipe::Recipe> = recipes.iter()
                .filter(|r| r.facility_id == facility.facility_id)
                .collect();

            if facility_recipes.is_empty() { continue; }

            // --- 1, 2, 3. Detection, Matching & Output Safety Check ---
            if facility.active_recipe_id.is_none() {
                for recipe in &facility_recipes {
                    // Step 1 & 2: Check inputs (Jenis & Jumlah)
                    let mut input_satisfied = true;
                    for input in &recipe.inputs {
                        let total_in_buffer: u32 = facility.input_buffer.iter()
                            .filter(|s| s.item_id == input.item_id)
                            .map(|s| s.quantity)
                            .sum();
                        if (total_in_buffer as f32) < input.amount {
                            input_satisfied = false;
                            break;
                        }
                    }
                    if !input_satisfied { continue; }

                    // Step 3: Safety Check Slot Out
                    // Block jika ada item di output buffer yang berbeda jenis dengan hasil resep
                    let output_compatible = facility.output_buffer.is_empty() || facility.output_buffer.iter().all(|slot| {
                        recipe.outputs.iter().any(|out| out.item_id == slot.item_id)
                    });
                    if !output_compatible { continue; }

                    // Step 4: Konsumsi Item
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
                            } else { break; }
                        }
                    }

                    // Step 5: Timer Dimulai
                    facility.active_recipe_id = Some(recipe.id.clone());
                    facility.recipe_progress = now; 
                    break; 
                }
            }

            // --- 6 & 7. Timer & Produksi ---
            if let Some(recipe_id) = facility.active_recipe_id.clone() {
                if let Some(recipe) = recipes.iter().find(|r| r.id == recipe_id) {
                    let elapsed = now - facility.recipe_progress; // Step 6: Timer berjalan (/s)
                    
                    if elapsed >= recipe.crafting_time as f64 {
                        // Step 7: Timer Selesai -> Munculkan item hasil ke slot out
                        for output in &recipe.outputs {
                            // Tambah jumlah jika item sama, atau buat slot baru
                            if let Some(pos) = facility.output_buffer.iter_mut().position(|s| s.item_id == output.item_id) {
                                facility.output_buffer[pos].quantity += output.amount as u32;
                            } else {
                                facility.output_buffer.push(BufferSlot {
                                    item_id: output.item_id.clone(),
                                    quantity: output.amount as u32,
                                    source_port_id: None,
                                    target_port_id: None,
                                });
                            }
                        }
                        
                        // Reset untuk resep berikutnya
                        facility.active_recipe_id = None;
                        facility.recipe_progress = 0.0;
                    }
                }
            }
        }

    }

}
