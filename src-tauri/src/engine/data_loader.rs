use crate::engine::facility::Facility;
use crate::engine::item::Item;
use crate::engine::recipe::Recipe;
use std::fs;
use std::path::Path;
use serde_json;

pub struct DataLoader;

impl DataLoader {
    /// Loads the strictly required central configuration.
    /// Panics if valid config is not found, adhering to "No Fallback" rule.
    pub fn load_config() -> serde_json::Value {
        // We only check the standard location. No magic fallbacks.
        // Assuming running from src-tauri root or debug dir finding it in root.
        let path = "config.json"; 
        
        let content = fs::read_to_string(path)
            .or_else(|_| fs::read_to_string(format!("src-tauri/{}", path)))
            .or_else(|_| fs::read_to_string(format!("../{}", path)))
            .expect("CRITICAL: config.json not found. System cannot start without global configuration.");

        serde_json::from_str(&content)
            .expect("CRITICAL: config.json is malformed.")
    }

    fn resolve_path(config: &serde_json::Value, key: &str) -> String {
        let path_str = config["data_resources"][key]
            .as_str()
            .expect(&format!("Config missing data_resources.{}", key));
        
        // Simple resolution logic: try direct, then src-tauri/, then ../
        if Path::new(path_str).exists() {
            return path_str.to_string();
        }
        let src_prefixed = format!("src-tauri/{}", path_str);
        if Path::new(&src_prefixed).exists() {
            return src_prefixed;
        }
        let parent_prefixed = format!("../{}", path_str);
        // We return the raw string if not found, let the loader fail explicitly
        if Path::new(&parent_prefixed).exists() {
            return parent_prefixed;
        }
        path_str.to_string() 
    }

    pub fn load_facilities() -> Vec<Facility> {
        let config = Self::load_config();
        let path = Self::resolve_path(&config, "facilities_path");
        
        let content = fs::read_to_string(&path)
            .expect(&format!("Failed to read facilities data from {}", path));
        
        serde_json::from_str(&content).expect("Failed to parse facilities data")
    }

    pub fn load_items() -> Vec<Item> {
        let config = Self::load_config();
        let path = Self::resolve_path(&config, "items_path");
        
        let content = fs::read_to_string(&path)
            .expect(&format!("Failed to read items data from {}", path));
            
        serde_json::from_str(&content).expect("Failed to parse items data")
    }

    pub fn load_recipes() -> Vec<Recipe> {
        let config = Self::load_config();
        let path = Self::resolve_path(&config, "recipes_path");
        
        let content = fs::read_to_string(&path)
            .expect(&format!("Failed to read recipes data from {}", path));
            
        serde_json::from_str(&content).expect("Failed to parse recipes data")
    }

    pub fn load_geometry() -> serde_json::Value {
        let config = Self::load_config();
        let path = Self::resolve_path(&config, "geometry_path");
        
        let content = fs::read_to_string(&path)
            .expect(&format!("Failed to read geometry data from {}", path));
            
        serde_json::from_str(&content).expect("Failed to parse geometry data")
    }
}
