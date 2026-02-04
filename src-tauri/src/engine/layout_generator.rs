use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use rand::Rng;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlacedFacilityLayout {
    pub facility_id: String,
    pub x: i32,
    pub y: i32,
    pub rotation: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutCandidate {
    pub id: String,
    pub facilities: Vec<PlacedFacilityLayout>,
    pub score: f64,
    pub power_consumption: f64,
    pub items_per_hour: HashMap<String, f64>,
    pub efficiency: f64,
    pub limiting_factor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConstraints {
    pub plate_width: i32,
    pub plate_height: i32,
    pub power_source_type: String,
    pub power_source_x: i32,
    pub power_source_y: i32,
    pub max_power_budget: Option<f64>,
}

pub struct LayoutGenerator {
    constraints: LayoutConstraints,
    geometry: serde_json::Value,
}

impl LayoutGenerator {
    pub fn new(constraints: LayoutConstraints, geometry: serde_json::Value) -> Self {
        Self { constraints, geometry }
    }

    /// Get facility dimensions from geometry data
    fn get_facility_size(&self, facility_type: &str) -> Option<(i32, i32)> {
        let geom_array = self.geometry.as_array()?;
        for item in geom_array {
            if item["type"].as_str()? == facility_type {
                let width = item["width"].as_i64()? as i32;
                let height = item["height"].as_i64()? as i32;
                return Some((width, height));
            }
        }
        None
    }

    /// Check if placement is valid (no collision, within bounds)
    fn is_valid_placement(
        &self,
        x: i32,
        y: i32,
        width: i32,
        height: i32,
        existing: &[PlacedFacilityLayout],
        facilities_meta: &HashMap<String, (i32, i32)>,
    ) -> bool {
        // Check bounds
        if x < 0 || y < 0 || x + width > self.constraints.plate_width || y + height > self.constraints.plate_height {
            return false;
        }

        // Check collision with existing facilities
        for placed in existing {
            let (pw, ph) = facilities_meta.get(&placed.facility_id).unwrap_or(&(1, 1));
            let (pw, ph) = if placed.rotation == 90 || placed.rotation == 270 {
                (*ph, *pw)
            } else {
                (*pw, *ph)
            };

            // Overlap check: separated if (A.right <= B.left || A.left >= B.right || ...)
            // We want to return false if they overlap.
            if !(x + width <= placed.x || x >= placed.x + pw || y + height <= placed.y || y >= placed.y + ph) {
                return false; // Overlap detected
            }
        }

        true // Valid (In bounds and no collision)
    }

    /// Generate random layout using greedy placement
    fn generate_random_layout(
        &self,
        required_facilities: &[(String, String, f64)], // (facility_id, type, count)
        facilities_meta: &HashMap<String, (i32, i32)>,
    ) -> Option<Vec<PlacedFacilityLayout>> {
        let mut rng = rand::thread_rng();
        let mut placed: Vec<PlacedFacilityLayout> = Vec::new();

        // Place power source first (Auto-centered for better distribution)
        let pac_x = (self.constraints.plate_width / 2) - 1;
        let pac_y = (self.constraints.plate_height / 2) - 1;
        
        placed.push(PlacedFacilityLayout {
            facility_id: self.constraints.power_source_type.clone(),
            x: pac_x,
            y: pac_y,
            rotation: 0,
        });

        // Place each required facility
        for (facility_id, facility_type, count) in required_facilities {
            let instances = count.ceil() as i32;
            let (width, height) = facilities_meta.get(facility_type).unwrap_or(&(3, 3));

            for _ in 0..instances {
                let mut attempts = 0;
                let max_attempts = 150; // Increased search space

                while attempts < max_attempts {
                    // Try to place near the center/PAC first
                    let spread = 10 + (attempts / 5);
                    let min_x = (pac_x - spread).max(0);
                    let max_x = (pac_x + spread).min(self.constraints.plate_width - width);
                    let min_y = (pac_y - spread).max(0);
                    let max_y = (pac_y + spread).min(self.constraints.plate_height - height);

                    let x = if max_x > min_x { rng.gen_range(min_x..max_x) } else { 0 };
                    let y = if max_y > min_y { rng.gen_range(min_y..max_y) } else { 0 };
                    
                    let rotation = [0, 90, 180, 270][rng.gen_range(0..4)];

                    let (final_w, final_h) = if rotation == 90 || rotation == 270 {
                        (*height, *width)
                    } else {
                        (*width, *height)
                    };

                    if self.is_valid_placement(x, y, final_w, final_h, &placed, facilities_meta) {
                        placed.push(PlacedFacilityLayout {
                            facility_id: facility_id.clone(),
                            x,
                            y,
                            rotation,
                        });
                        break;
                    }

                    attempts += 1;
                }

                if attempts >= max_attempts {
                    return None; // Failed to place all facilities
                }
            }
        }

        Some(placed)
    }

    /// Score a layout based on multiple criteria
    fn score_layout(
        &self,
        layout: &[PlacedFacilityLayout],
        power_consumption: f64,
        items_per_hour: &HashMap<String, f64>,
    ) -> f64 {
        // Criteria:
        // 1. Power efficiency (lower is better)
        // 2. Compactness (smaller bounding box is better)
        // 3. Throughput (higher items/hour is better)

        let power_score = if power_consumption > 0.0 {
            1000.0 / power_consumption
        } else {
            1000.0
        };

        // Calculate bounding box
        let mut max_x = 0;
        let mut max_y = 0;
        for placed in layout {
            max_x = max_x.max(placed.x);
            max_y = max_y.max(placed.y);
        }
        let area = (max_x * max_y) as f64;
        let compactness_score = if area > 0.0 {
            10000.0 / area
        } else {
            100.0
        };

        let throughput_score: f64 = items_per_hour.values().sum();

        // Weighted combination
        power_score * 0.3 + compactness_score * 0.3 + throughput_score * 0.4
    }

    /// Generate multiple layout candidates
    pub fn generate_layouts(
        &self,
        required_facilities: Vec<(String, String, f64)>,
        target_items: &[(String, f64)],
        num_candidates: usize,
    ) -> Vec<LayoutCandidate> {
        let mut candidates: Vec<LayoutCandidate> = Vec::new();

        // Build facility metadata map
        let mut facilities_meta: HashMap<String, (i32, i32)> = HashMap::new();
        
        // Add power source meta (keyed by ID)
        let power_source_name = "Protocol Automation-Core (PAC)"; // Mapping ID 'pac' to geometry name
        if let Some(size) = self.get_facility_size(power_source_name) {
            facilities_meta.insert(self.constraints.power_source_type.clone(), size);
        } else {
             // Fallback for PAC
             facilities_meta.insert(self.constraints.power_source_type.clone(), (8, 9));
        }

        for (facility_id, facility_type, _) in &required_facilities {
            if let Some(size) = self.get_facility_size(facility_type) {
                facilities_meta.insert(facility_id.clone(), size);
            } else {
                // Fallback for generic facilities
                facilities_meta.insert(facility_id.clone(), (3, 3));
            }
        }

        // Generate candidates
        for i in 0..num_candidates {
            if let Some(layout) = self.generate_random_layout(&required_facilities, &facilities_meta) {
                // Calculate metrics
                let power_consumption: f64 = required_facilities.iter()
                    .map(|(_, _, count)| count * 10.0) // Placeholder power calc
                    .sum();

                let items_per_hour: HashMap<String, f64> = target_items.iter()
                    .map(|(id, rate)| (id.clone(), rate * 60.0))
                    .collect();

                let score = self.score_layout(&layout, power_consumption, &items_per_hour);

                candidates.push(LayoutCandidate {
                    id: format!("layout_{}", i),
                    facilities: layout,
                    score,
                    power_consumption,
                    items_per_hour,
                    efficiency: score / power_consumption.max(1.0),
                    limiting_factor: None,
                });
            }
        }

        // Sort by score (descending)
        candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

        candidates
    }
}
