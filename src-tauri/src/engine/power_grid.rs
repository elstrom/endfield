use crate::engine::facility::PlacedFacility;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct PowerGrid {
    pub total_generation: f32,
    pub total_consumption: f32,
    pub powered_facilities: HashSet<String>,
}

impl PowerGrid {
    pub fn new() -> Self {
        Self {
            total_generation: 0.0,
            total_consumption: 0.0,
            powered_facilities: HashSet::new(),
        }
    }

    /// Calculate power distribution from generators (PAC, Thermal Bank) to consumers
    /// Electric Pylon broadcasts power in 12x12 radius
    pub fn calculate(
        &mut self,
        facilities: &[PlacedFacility],
        geometry: &serde_json::Value,
        grid_size: u32,
    ) {
        self.total_generation = 0.0;
        self.total_consumption = 0.0;
        self.powered_facilities.clear();

        let empty_vec = vec![];
        let geom_array = geometry.as_array().unwrap_or(&empty_vec);

        // Find all generators and pylons
        let mut generators: Vec<(&PlacedFacility, f32)> = Vec::new();
        let mut pylons: Vec<&PlacedFacility> = Vec::new();
        let mut consumers: Vec<(&PlacedFacility, f32)> = Vec::new();

        for facility in facilities {
            if let Some(geom) = geom_array.iter().find(|g| {
                g["type"].as_str().unwrap_or("") == facility.facility_id
            }) {
                let power = geom["power_consumption"].as_f64().unwrap_or(0.0) as f32;

                if power < 0.0 {
                    // Generator (PAC, Thermal Bank)
                    generators.push((facility, -power));
                    self.total_generation += -power;
                } else if power > 0.0 {
                    // Consumer
                    consumers.push((facility, power));
                    self.total_consumption += power;
                }

                // Check if it's a Power Diffuser (Electric Pylon)
                if geom["type"].as_str().unwrap_or("") == "Power Diffuser" {
                    pylons.push(facility);
                }
            }
        }

        // Power distribution logic
        // 1. Direct connection: facilities within 12x12 of a pylon get power
        // 2. Pylons must be within range of a generator to broadcast
        
        let pylon_range = 12 * grid_size as i32;
        let mut active_pylons: HashSet<String> = HashSet::new();

        // Activate pylons near generators
        for pylon in &pylons {
            for (gen, _) in &generators {
                let dist = Self::manhattan_distance(pylon, gen);
                if dist <= pylon_range {
                    active_pylons.insert(pylon.instance_id.clone());
                    break;
                }
            }
        }

        // Power consumers within range of active pylons or generators
        for (consumer, _power) in &consumers {
            let mut is_powered = false;

            // Check direct generator connection
            for (gen, _) in &generators {
                if Self::manhattan_distance(consumer, gen) <= pylon_range {
                    is_powered = true;
                    break;
                }
            }

            // Check pylon broadcast
            if !is_powered {
                for pylon in &pylons {
                    if active_pylons.contains(&pylon.instance_id) {
                        if Self::manhattan_distance(consumer, pylon) <= pylon_range {
                            is_powered = true;
                            break;
                        }
                    }
                }
            }

            if is_powered {
                self.powered_facilities.insert(consumer.instance_id.clone());
            }
        }
    }

    fn manhattan_distance(a: &PlacedFacility, b: &PlacedFacility) -> i32 {
        (a.x - b.x).abs() + (a.y - b.y).abs()
    }

    pub fn is_powered(&self, instance_id: &str) -> bool {
        self.powered_facilities.contains(instance_id)
    }

    pub fn get_power_balance(&self) -> f32 {
        self.total_generation - self.total_consumption
    }
}
