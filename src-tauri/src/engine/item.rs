use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub tier: u32,
    pub icon: String,
    pub state: Option<String>,
    #[serde(rename = "is_raw", default)]
    pub is_raw_material: bool,
}
