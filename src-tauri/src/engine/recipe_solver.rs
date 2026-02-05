use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use crate::engine::data_loader::DataLoader;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeInput {
    pub item_id: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeOutput {
    pub item_id: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipe {
    pub id: String,
    pub name: Option<String>, // Made optional to prevent crash if missing
    pub inputs: Vec<RecipeInput>,
    pub outputs: Vec<RecipeOutput>,
    pub facility_id: String,
    pub crafting_time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacilityRequirement {
    pub facility_id: String,
    pub facility_type: String, // Display Name
    pub count: f64,
    pub recipe_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionPlan {
    pub target_items: Vec<String>,
    pub actual_rates: HashMap<String, f64>, // item_id -> actual achievable rate
    pub required_facilities: Vec<FacilityRequirement>,
    pub raw_materials: HashMap<String, f64>,
    pub total_power: f64,
    pub constraint_limited: bool,
    pub limiting_factor: Option<String>,
}

pub struct RecipeSolver {
    recipes: Vec<Recipe>,
    facilities: HashMap<String, crate::engine::facility::Facility>,
}

impl RecipeSolver {
    pub fn new(
        recipes: Vec<Recipe>,
        facilities: HashMap<String, crate::engine::facility::Facility>,
    ) -> Self {
        Self { recipes, facilities }
    }

    /// Find all recipes that produce a given item
    fn find_recipes_for_item(&self, item_id: &str) -> Vec<&Recipe> {
        self.recipes
            .iter()
            .filter(|r| r.outputs.iter().any(|o| o.item_id == item_id))
            .collect()
    }

    /// Calculate production rate (items per minute)
    fn calc_rate(amount: f64, crafting_time: f64) -> f64 {
        // Validation for zero crafting time to prevent NaN
        if crafting_time <= 0.0001 { return 0.0; }
        (amount * 60.0) / crafting_time
    }

    /// Solve production requirements validating against "Hard Constraints" from Config
    pub fn solve(
        &self,
        target_items: Vec<(String, f64)>, // (item_id, requested_rate)
        plate_width: i32,
        plate_height: i32,
    ) -> Result<ProductionPlan, String> {
        let config = DataLoader::load_config();
        
        // Extract Simulation Constants
        let _time_scale = config["simulation_constants"]["time_unit_scale"].as_f64().unwrap_or(60.0);
        let usable_area_ratio = config["simulation_constants"]["usable_area_ratio"].as_f64().unwrap_or(0.75);
        let base_power_budget = config["simulation_constants"]["base_power_budget"].as_f64().unwrap_or(5000.0);
        let min_demand_threshold = config["optimization_constraints"]["min_demand_threshold"].as_f64().unwrap_or(0.0001);

        let mut required_facilities: Vec<FacilityRequirement> = Vec::new();
        let mut item_demands: HashMap<String, f64> = HashMap::new();
        let mut processed_items: HashSet<String> = HashSet::new();
        let mut raw_materials: HashMap<String, f64> = HashMap::new();

        // Initialize with target demands
        for (item_id, rate) in &target_items {
            item_demands.insert(item_id.clone(), *rate);
        }

        // 1. Calculate Theoretical Requirements (Top-Down Demand Propagation)
        let mut stack: Vec<String> = target_items.iter().map(|(id, _)| id.clone()).collect();
        let mut temp_processed = HashSet::new();

        while let Some(item_id) = stack.pop() {
            if temp_processed.contains(&item_id) { continue; }
            
            let demand = *item_demands.get(&item_id).unwrap_or(&0.0);
            if demand <= min_demand_threshold { continue; }

            let recipes = self.find_recipes_for_item(&item_id);
            if recipes.is_empty() {
                // Raw material node
                raw_materials.insert(item_id.clone(), demand);
                temp_processed.insert(item_id.clone());
                continue;
            }

            // Simple heuristic: Take the first recipe (TODO: Advanced Recipe Selection)
            let recipe = recipes[0];
            
            let output = recipe.outputs.iter().find(|o| o.item_id == item_id).unwrap();
            let production_rate_per_facility = Self::calc_rate(output.amount, recipe.crafting_time);
            
            // demand is items/min. rate is items/min/facility.
            let facility_count = demand / production_rate_per_facility;

            // Get facility info
            let facility = self.facilities.get(&recipe.facility_id)
                .ok_or_else(|| format!("Facility not found: {}", recipe.facility_id))?;

            required_facilities.push(FacilityRequirement {
                facility_id: recipe.facility_id.clone(),
                facility_type: facility.name.clone(),
                count: facility_count,
                recipe_id: recipe.id.clone(),
            });

            // Add input demands to the map
            for input in &recipe.inputs {
                // Rate required = (input_amount / output_amount) * demand
                let input_rate = (input.amount / output.amount) * demand;
                *item_demands.entry(input.item_id.clone()).or_insert(0.0) += input_rate;
                stack.push(input.item_id.clone());
            }
            
            temp_processed.insert(item_id);
        }

        // 2. Validate Constraints (The "Bottleneck" Check)
        let total_area_blocks = (plate_width * plate_height) as f64;
        let max_usable_area = total_area_blocks * usable_area_ratio;
        
        let mut total_facility_area = 0.0;
        let mut total_power_consumption = 0.0;

        for req in &required_facilities {
            if let Some(fac) = self.facilities.get(&req.facility_id) {
                // Area = width * height * count
                let area = (fac.width * fac.height) as f64 * req.count;
                total_facility_area += area;
                
                // Power = power * count
                total_power_consumption += fac.power_consumption as f64 * req.count;
            }
        }

        // 3. Calculate Scale Factor (Weakest Link Principle)
        let mut scale_factor = 1.0;
        let mut limiting_factor = None;

        // Space Constraint
        if total_facility_area > max_usable_area {
            let area_scale = max_usable_area / total_facility_area;
            if area_scale < scale_factor {
                scale_factor = area_scale;
                limiting_factor = Some(format!("Space Constraints (Capacity at {:.0}%)", area_scale * 100.0));
            }
        }
        
        // Power Constraint
        if total_power_consumption > base_power_budget {
            let power_scale = base_power_budget / total_power_consumption;
            if power_scale < scale_factor {
                scale_factor = power_scale;
                limiting_factor = Some(format!("Power Grid Overload (Capacity at {:.0}%)", power_scale * 100.0));
            }
        }

        // 4. Apply Scaling and Finalize Plan
        if scale_factor < 1.0 {
            for req in &mut required_facilities {
                req.count *= scale_factor;
            }
            for val in raw_materials.values_mut() {
                *val *= scale_factor;
            }
            total_power_consumption *= scale_factor;
        }

        let mut actual_rates = HashMap::new();
        for (item_id, target_rate) in target_items {
            actual_rates.insert(item_id, target_rate * scale_factor);
        }

        Ok(ProductionPlan {
            target_items: actual_rates.keys().cloned().collect(),
            actual_rates,
            required_facilities,
            raw_materials,
            total_power: total_power_consumption,
            constraint_limited: scale_factor < 0.999, // Floating point tolerance
            limiting_factor,
        })
    }
}
