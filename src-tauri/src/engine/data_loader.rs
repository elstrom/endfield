use crate::engine::facility::Facility;
use crate::engine::item::Item;
use crate::engine::recipe::Recipe;
use std::fs;
use std::path::Path;
use serde_json;

pub struct DataLoader;

impl DataLoader {
    fn load_database() -> serde_json::Value {
        // Prioritize the root database.json (../database.json when running from src-tauri)
        // to avoid triggering the hot-reload watcher which watches src-tauri.
        let content = fs::read_to_string("../database.json")
            .or_else(|_| fs::read_to_string("database.json"))
            .or_else(|_| fs::read_to_string("src-tauri/database.json"))
            .or_else(|_| fs::read_to_string(r"d:\Gawe\AI\endfield\database.json"))
            .expect("CRITICAL: database.json not found.");
        serde_json::from_str(&content).expect("Malformed database.json")
    }

    fn save_database(db: serde_json::Value) {
        let content = serde_json::to_string_pretty(&db).expect("Failed to serialize database");
        
        // Try to write to the root database.json first (../database.json)
        // This prevents the loop/restart issue.
        if fs::write("../database.json", &content).is_err() {
            // Fallback to local if parent fails (unlikely in dev)
            if fs::write("database.json", &content).is_err() {
                fs::write(r"d:\Gawe\AI\endfield\database.json", &content).expect("Failed to write database.json");
            }
        }
    }

    pub fn update_config(new_config: serde_json::Value) {
        let mut db = Self::load_database();
        db["config"] = new_config;
        Self::save_database(db);
    }

    /// Loads the configuration section from database.json
    pub fn load_config() -> serde_json::Value {
        let db = Self::load_database();
        db["config"].clone()
    }

    pub fn load_facilities() -> Vec<Facility> {
        let db = Self::load_database();
        serde_json::from_value(db["facilities"].clone()).unwrap_or_default()
    }

    pub fn load_items() -> Vec<Item> {
        let db = Self::load_database();
        serde_json::from_value(db["items"].clone()).unwrap_or_default()
    }

    pub fn load_recipes() -> Vec<Recipe> {
        let db = Self::load_database();
        serde_json::from_value(db["recipes"].clone()).unwrap_or_default()
    }

    /// Geometry is now embedded in facilities, but if we need a separate geometry object 
    /// for some reason, we can extract it or return the facilities themselves.
    /// The frontend/engine might expect the old geometry format which was a list of types.
    /// In the new database, facilities ARE the geometry + metadata.
    /// We will return the list of facilities 'as' the geometry value for now.
    pub fn load_geometry() -> serde_json::Value {
        let db = Self::load_database();
        // The old code expected an array of geometry objects. The new "facilities" array
        // contains objects with "width", "height", "ports" which matches the geometry shape
        // closely enough for the engine's usage (grid alignment), 
        // ALTHOUGH the engine might look for "type" field instead of relying on ID mapping.
        // Let's ensure the Engine uses "name" or "id" correctly. 
        // For compability, we return the facilities array.
        db["facilities"].clone()
    }
}

