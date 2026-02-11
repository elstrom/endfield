use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Port {
    pub id: String,
    pub x: u32,
    pub y: u32,
    #[serde(rename = "type")]
    pub port_type: String, // "input" or "output"
    pub direction: String, // "left", "right", "top", "bottom"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Facility {
    pub id: String,
    pub name: String,
    pub width: u32,  // Ukuran dalam grid (misal: 8)
    pub height: u32, // Ukuran dalam grid (misal: 8)
    #[serde(rename = "power")]
    pub power_consumption: f32,
    #[serde(default)]
    pub tier: u32,
    pub icon: Option<String>,
    pub category: Option<String>,
    pub ports: Option<Vec<Port>>,
    pub input_slots: Option<u32>,
    pub output_slots: Option<u32>,
    pub throughput_limit: Option<f32>,
    pub is_filter: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortSetting {
    pub port_id: String,
    pub item_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BufferSlot {
    pub item_id: String,
    pub source_port_id: Option<String>,
    pub target_port_id: Option<String>,
    pub quantity: u32,
    #[serde(default)]
    pub progress: f64, // 0.0 to 1.0 representing movement progress
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlacedFacility {
    pub instance_id: String,
    pub facility_id: String,
    pub x: i32,
    pub y: i32,
    pub rotation: u32, // 0, 90, 180, 270
    pub port_settings: Option<Vec<PortSetting>>,
    #[serde(default)]
    pub input_buffer: Vec<BufferSlot>,
    #[serde(default)]
    pub output_buffer: Vec<BufferSlot>,
    #[serde(default)]
    pub active_recipe_id: Option<String>,
    #[serde(default)]
    pub recipe_progress: f64,
}
