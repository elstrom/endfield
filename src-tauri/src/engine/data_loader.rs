use crate::engine::facility::Facility;
use crate::engine::item::Item;
use crate::engine::recipe::Recipe;
use std::fs;
use serde_json;

pub struct DataLoader;

impl DataLoader {
    pub fn load_config() -> serde_json::Value {
        let paths = ["config.json", "../config.json", "src-tauri/config.json"];
        for path in paths {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(json) = serde_json::from_str(&content) {
                    return json;
                }
            }
        }
        serde_json::json!({})
    }

    pub fn load_facilities() -> Vec<Facility> {
        let paths = ["data/facilities.json", "src-tauri/data/facilities.json"];
        for path in paths {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(json) = serde_json::from_str(&content) {
                    return json;
                }
            }
        }
        vec![]
    }

    pub fn load_items() -> Vec<Item> {
        let paths = ["data/items.json", "src-tauri/data/items.json"];
        for path in paths {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(json) = serde_json::from_str(&content) {
                    return json;
                }
            }
        }
        vec![]
    }

    pub fn load_recipes() -> Vec<Recipe> {
        let paths = ["data/recipes.json", "src-tauri/data/recipes.json"];
        for path in paths {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(json) = serde_json::from_str(&content) {
                    return json;
                }
            }
        }
        vec![]
    }

    pub fn load_geometry() -> serde_json::Value {
        let paths = ["facilities_geometry.json", "../facilities_geometry.json", "src-tauri/facilities_geometry.json"];
        for path in paths {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(json) = serde_json::from_str(&content) {
                    return json;
                }
            }
        }
        serde_json::json!([])
    }
}
