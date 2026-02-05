use crate::engine::facility::{PlacedFacility, Facility};
use crate::engine::logistics::LogisticsEdge;
use crate::engine::power_grid::PowerGrid;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct GridState {
    pub width: u32,
    pub height: u32,
    pub placed_facilities: Vec<PlacedFacility>,
    pub logistics_edges: Vec<LogisticsEdge>,
    #[serde(skip)]
    pub occupancy: Vec<bool>, // Fast lookup for occupancy
    #[serde(skip)]
    pub power_grid: PowerGrid,
    #[serde(skip)]
    pub grid_size: u32,
}

impl GridState {
    pub fn new(config: &serde_json::Value) -> Self {
        let width = config["simulation_constants"]["default_plate_width"].as_u64().unwrap_or(32) as u32;
        let height = config["simulation_constants"]["default_plate_height"].as_u64().unwrap_or(32) as u32;
        // Grid size is implicitly 1x1 block in this logic
        let grid_size = 1; 
        
        Self {
            width,
            height,
            placed_facilities: Vec::new(),
            logistics_edges: Vec::new(),
            occupancy: vec![false; (width * height) as usize],
            power_grid: PowerGrid::new(),
            grid_size,
        }
    }

    pub fn update_power_grid(&mut self, geometry: &serde_json::Value) {
        self.power_grid.calculate(&self.placed_facilities, geometry, self.grid_size);
    }

    pub fn is_area_clear(&self, x: i32, y: i32, w: u32, h: u32) -> bool {
        for dy in 0..h {
            for dx in 0..w {
                let curr_x = x + dx as i32;
                let curr_y = y + dy as i32;
                
                if curr_x < 0 || curr_x >= self.width as i32 || curr_y < 0 || curr_y >= self.height as i32 {
                    return false;
                }
                
                if self.occupancy[(curr_y as u32 * self.width + curr_x as u32) as usize] {
                    return false;
                }
            }
        }
        true
    }

    pub fn place_facility(&mut self, facility: PlacedFacility, meta: &Facility) -> bool {
        if self.is_area_clear(facility.x, facility.y, meta.width, meta.height) {
            // Mark occupancy
            for dy in 0..meta.height {
                for dx in 0..meta.width {
                    let curr_x = (facility.x + dx as i32) as u32;
                    let curr_y = (facility.y + dy as i32) as u32;
                    self.occupancy[(curr_y * self.width + curr_x) as usize] = true;
                }
            }
            self.placed_facilities.push(facility);
            return true;
        }
        false
    }

    pub fn get_distance(a: &PlacedFacility, b: &PlacedFacility) -> f32 {
        let dx = (a.x - b.x) as f32;
        let dy = (a.y - b.y) as f32;
        (dx * dx + dy * dy).sqrt()
    }
}
