use crate::engine::facility::Facility;
use crate::engine::item::Item;
use crate::engine::recipe::Recipe;
use std::fs;
use serde_json;

pub struct DataLoader;

impl DataLoader {
    pub fn load_config() -> serde_json::Value {
        let content = fs::read_to_string("../config.json")
            .unwrap_or_else(|_| "{}".to_string());
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    }

    pub fn load_facilities() -> Vec<Facility> {
        let content = fs::read_to_string("data/facilities.json")
            .unwrap_or_else(|_| "[]".to_string());
        serde_json::from_str(&content).unwrap_or_default()
    }

    pub fn load_items() -> Vec<Item> {
        let content = fs::read_to_string("data/items.json")
            .unwrap_or_else(|_| "[]".to_string());
        serde_json::from_str(&content).unwrap_or_default()
    }

    pub fn load_recipes() -> Vec<Recipe> {
        let content = fs::read_to_string("data/recipes.json")
            .unwrap_or_else(|_| "[]".to_string());
        serde_json::from_str(&content).unwrap_or_default()
    }
}
