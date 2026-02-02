use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Facility {
    pub id: String,
    pub name: String,
    pub width: u32,  // Ukuran dalam grid (misal: 8)
    pub height: u32, // Ukuran dalam grid (misal: 8)
    pub power_consumption: f32,
    pub tier: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlacedFacility {
    pub instance_id: String,
    pub facility_id: String,
    pub x: i32,
    pub y: i32,
    pub rotation: u32, // 0, 90, 180, 270
}
