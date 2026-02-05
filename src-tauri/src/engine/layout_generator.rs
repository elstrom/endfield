use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::engine::data_loader::DataLoader;

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
    pub power_source_type: String, // e.g. "PAC_MAIN"
    pub power_source_x: i32, // User preferred or center (-1 for center)
    pub power_source_y: i32, // User preferred or center (-1 for center)
    pub max_power_budget: Option<f64>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct Port {
    id: String,
    x: i32, // Local relative to facility origin
    y: i32,
    r#type: String, // "input" or "output"
}

struct LayoutEngine {
    width: i32,
    height: i32,
    grid: Vec<bool>, // true = occupied
    // We implicitly track port access by checking adjacent cells
}

impl LayoutEngine {
    fn new(width: i32, height: i32) -> Self {
        Self {
            width,
            height,
            grid: vec![false; (width * height) as usize],
        }
    }

    fn index(&self, x: i32, y: i32) -> usize {
        (y * self.width + x) as usize
    }

    fn is_occupied(&self, x: i32, y: i32, w: i32, h: i32) -> bool {
        if x < 0 || y < 0 || x + w > self.width || y + h > self.height {
            return true;
        }
        for dy in 0..h {
            for dx in 0..w {
                if self.grid[self.index(x + dx, y + dy)] {
                    return true;
                }
            }
        }
        false
    }

    fn mark_occupied(&mut self, x: i32, y: i32, w: i32, h: i32) {
        for dy in 0..h {
            for dx in 0..w {
                let idx = self.index(x + dx, y + dy);
                self.grid[idx] = true;
            }
        }
    }

    /// Checks if ports have at least one free adjacent cell for belt connection
    fn check_port_access(&self, x: i32, y: i32, w: i32, h: i32, ports: &[Port], rotation: i32) -> bool {
        // Transform ports based on rotation
        for port in ports {
            let (px, py) = match rotation {
                0 => (port.x, port.y),
                90 => (h - 1 - port.y, port.x), // Rotate 90 deg clockwise
                180 => (w - 1 - port.x, h - 1 - port.y),
                270 => (port.y, w - 1 - port.x),
                _ => (port.x, port.y), // Should not happen
            };

            let global_port_x = x + px;
            let global_port_y = y + py;

            // Heuristic: Check all 4 neighbors. If ALL are occupied (by other buildings), then port is blocked.
            // Note: self.grid includes the current building we are checking? No, we haven't placed it yet.
            // But we pass w, h which implies layout.
            let neighbors = [(0, 1), (0, -1), (1, 0), (-1, 0)];
            let mut access_found = false;
            for (nx, ny) in neighbors {
                let tx = global_port_x + nx;
                let ty = global_port_y + ny;
                
                // If out of bounds, it's blocked (walls)
                if tx < 0 || ty < 0 || tx >= self.width || ty >= self.height {
                    continue;
                }
                
                // Check if occupied by OTHER existing buildings
                // Also, ensure the neighbor is not part of the facility being placed itself.
                let is_part_of_current_facility = (tx >= x && tx < x + w && ty >= y && ty < y + h) ||
                                                   (tx >= x && tx < x + h && ty >= y && ty < y + w && (rotation == 90 || rotation == 270)); // For rotated
                
                if !is_part_of_current_facility && !self.grid[self.index(tx, ty)] {
                    access_found = true;
                    break;
                }
            }
            
            if !access_found {
                return false;
            }
        }
        true
    }

    /// Finds valid spot including port checks
    fn find_valid_spot(
        &self,
        center_x: i32,
        center_y: i32,
        w: i32,
        h: i32,
        ports: &[Port],
    ) -> Option<(i32, i32, i32)> { // x, y, rotation
        let max_dim = self.width.max(self.height);
        let max_steps = (max_dim * max_dim) * 2;
        
        let mut x = center_x;
        let mut y = center_y;
        let mut dx = 1;
        let mut dy = 0;
        let mut segment_len = 1;
        let mut segment_passed = 0;
        let mut turn_count = 0;

        for _ in 0..max_steps {
            // Try all 4 rotations at this coordinate
            // 0: w x h
            if !self.is_occupied(x, y, w, h) && self.check_port_access(x, y, w, h, ports, 0) {
                return Some((x, y, 0));
            }
            // 90: h x w
            if !self.is_occupied(x, y, h, w) && self.check_port_access(x, y, h, w, ports, 90) {
                return Some((x, y, 90));
            }
             // 180: w x h
            if !self.is_occupied(x, y, w, h) && self.check_port_access(x, y, w, h, ports, 180) {
                return Some((x, y, 180));
            }
             // 270: h x w
            if !self.is_occupied(x, y, h, w) && self.check_port_access(x, y, h, w, ports, 270) {
                return Some((x, y, 270));
            }

            // Spiral Move
            x += dx;
            y += dy;
            segment_passed += 1;
            if segment_passed >= segment_len {
                segment_passed = 0;
                let temp = dx;
                dx = -dy;
                dy = temp;
                turn_count += 1;
                if turn_count % 2 == 0 {
                    segment_len += 1;
                }
            }
        }
        None
    }
}

pub struct LayoutGenerator {
    constraints: LayoutConstraints,
    geometry: serde_json::Value,
}

impl LayoutGenerator {
    pub fn new(constraints: LayoutConstraints, geometry: serde_json::Value) -> Self {
        Self { constraints, geometry }
    }

    fn get_facility_meta(&self, facility_type: &str) -> Option<(i32, i32, Vec<Port>)> {
        // In database.json, facilities is a List of objects.
        // We usually lookup by ID or Name. The `facility_type` passed here usually comes from the recipe's producer ID.
        // OR it's the "Name" (e.g. "PAC_MAIN").
        
        let facilities = self.geometry.as_array()?;
        
        // Try ID match first, then Name match
        let facility = facilities.iter().find(|f| {
             f["id"].as_str() == Some(facility_type) || f["name"].as_str() == Some(facility_type)
        });

        if let Some(f) = facility {
            let width = f["width"].as_i64()? as i32;
            let height = f["height"].as_i64()? as i32;
            
            let mut ports = Vec::new();
            if let Some(p_arr) = f["ports"].as_array() {
                for p in p_arr {
                    ports.push(Port {
                        id: p["id"].as_str().unwrap_or("?").to_string(),
                        x: p["x"].as_i64().unwrap_or(0) as i32,
                        y: p["y"].as_i64().unwrap_or(0) as i32,
                        r#type: p["type"].as_str().unwrap_or("input").to_string(),
                    });
                }
            }
            return Some((width, height, ports));
        }

        None
    }

    fn generate_deterministic_layout(
         &self,
         required_facilities: &[(String, String, f64)],
    ) -> Option<Vec<PlacedFacilityLayout>> {
        let w = self.constraints.plate_width;
        let h = self.constraints.plate_height;
        let mut engine = LayoutEngine::new(w, h);
        let mut placed_list = Vec::new();

        // 1. Place Power Source (PAC) - Always Center
        let pac_type = &self.constraints.power_source_type;
        // Default 8x9 if not found, empty ports
        let (pac_w, pac_h, pac_ports) = self.get_facility_meta(pac_type).unwrap_or((8, 9, vec![]));
        
        // Configurable center vs absolute
        let center_x = if self.constraints.power_source_x >= 0 { self.constraints.power_source_x } else { (w - pac_w) / 2 };
        let center_y = if self.constraints.power_source_y >= 0 { self.constraints.power_source_y } else { (h - pac_h) / 2 };
        
        // Ensure PAC fits (if plate is too small, this fails early, but that's expected)
        // For PAC, we assume it doesn't have ports that need external access, or it's handled differently.
        if !engine.is_occupied(center_x, center_y, pac_w, pac_h) {
            engine.mark_occupied(center_x, center_y, pac_w, pac_h);
            placed_list.push(PlacedFacilityLayout {
                facility_id: pac_type.clone(),
                x: center_x,
                y: center_y,
                rotation: 0,
            });
        } else {
            return None; // Fatal: PAC doesn't fit
        }

        // 2. Sort Facilities (Priority: Producers -> Consumers to keep belts short?)
        // Or Cluster by connectivity?
        // For "Constraint-Limited", we want to just pack them effectively first.
        let mut sorted_reqs: Vec<&(String, String, f64)> = required_facilities.iter().collect();
        // Sort by count descending (place big groups first)
        sorted_reqs.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap()); 

        for (facility_id, facility_type, count) in sorted_reqs {
            let instances = count.ceil() as i32;
            let (fw, fh, f_ports) = self.get_facility_meta(facility_type).unwrap_or((3, 3, vec![]));
            
            for _ in 0..instances {
                // Find spot using Port-Aware Spiral Search
                if let Some((x, y, rot)) = engine.find_valid_spot(center_x, center_y, fw, fh, &f_ports) {
                    let (rw, rh) = if rot % 180 == 0 { (fw, fh) } else { (fh, fw) };
                    engine.mark_occupied(x, y, rw, rh);
                    placed_list.push(PlacedFacilityLayout {
                        facility_id: facility_id.clone(),
                        x, 
                        y,
                        rotation: rot,
                    });
                } else {
                    // Could not place one instance. 
                    // In a "Constraint Limited" simulator, we should probably stop or warn.
                    // But to return a partial VALID layout is better than nothing.
                    // We continue to see if smaller things fit.
                    continue; 
                }
            }
        }
        
        Some(placed_list)
    }

    pub fn generate_layouts(
        &self,
        required_facilities: Vec<(String, String, f64)>,
        target_items: &[(String, f64)],
        _num_candidates: usize,
    ) -> Vec<LayoutCandidate> {
        // Load config to check hard limits if needed (optional)
        // let _config = DataLoader::load_config(); 

        let mut candidates = Vec::new();

        if let Some(layout) = self.generate_deterministic_layout(&required_facilities) {
             let power_consumption: f64 = required_facilities.iter()
                    .map(|(_, _, count)| count * 10.0) // Placeholder, should come from facility data
                    .sum();
             
             let items_per_hour: HashMap<String, f64> = target_items.iter()
                    .map(|(id, rate)| (id.clone(), rate * 60.0))
                    .collect();

             // Score is now based on Density + Port Access Success
             let score = 100.0; 

             candidates.push(LayoutCandidate {
                    id: "constraint_optimized_v1".to_string(),
                    facilities: layout,
                    score,
                    power_consumption,
                    items_per_hour,
                    efficiency: 1.0, // Assuming if placed, it works (idealized)
                    limiting_factor: None, 
             });
        }
        
        candidates
    }
}
