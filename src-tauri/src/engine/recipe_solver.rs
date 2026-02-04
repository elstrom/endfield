use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

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
    pub inputs: Vec<RecipeInput>,
    pub outputs: Vec<RecipeOutput>,
    pub facility_id: String,
    pub crafting_time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacilityRequirement {
    pub facility_id: String,
    pub facility_type: String,
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
        (amount * 60.0) / crafting_time
    }

    /// Solve production requirements validating against constraints
    pub fn solve(
        &self,
        target_items: Vec<(String, f64)>, // (item_id, requested_rate)
        plate_width: i32,
        plate_height: i32,
    ) -> Result<ProductionPlan, String> {
        let mut required_facilities: Vec<FacilityRequirement> = Vec::new();
        let mut item_demands: HashMap<String, f64> = HashMap::new();
        let mut processed_items: HashSet<String> = HashSet::new();
        let mut raw_materials: HashMap<String, f64> = HashMap::new();

        // Initialize with target demands
        for (item_id, rate) in &target_items {
            item_demands.insert(item_id.clone(), *rate);
        }

        // 1. Calculate Theoretical Requirements (Unlimited)
        let mut stack: Vec<String> = target_items.iter().map(|(id, _)| id.clone()).collect();
        let mut temp_processed = HashSet::new();

        // Topological sort / Dependency check loop
        // Warning: This simple loop assumes no cycles. Endfield recipes generally don't have cycles except complex ones.
        // For simplicity, we process demand propagation.
        
        // We'll use a loop that processes items when their dependencies are known or they are targets
        // Actually, the previous stack approach was fine for trees.
        
        while let Some(item_id) = stack.pop() {
            // Checks to prevent infinite loops if cycles exist
            if temp_processed.contains(&item_id) { continue; }
            
            let demand = *item_demands.get(&item_id).unwrap_or(&0.0);
            if demand <= 0.0001 { continue; }

            let recipes = self.find_recipes_for_item(&item_id);
            if recipes.is_empty() {
                // Raw material
                raw_materials.insert(item_id.clone(), demand);
                temp_processed.insert(item_id.clone());
                continue;
            }

            let recipe = recipes[0]; // TODO: Smart recipe selection
            
            let output = recipe.outputs.iter().find(|o| o.item_id == item_id).unwrap();
            let production_rate_per_facility = Self::calc_rate(output.amount, recipe.crafting_time);
            
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

            // Add input demands
            for input in &recipe.inputs {
                // Input rate needed = (input_amount / crafting_time * 60) * facility_count
                // Simplified: (input_amount / output_amount) * demand
                let input_rate = (input.amount / output.amount) * demand;
                *item_demands.entry(input.item_id.clone()).or_insert(0.0) += input_rate;
                stack.push(input.item_id.clone());
            }
            
            temp_processed.insert(item_id);
        }

        // 2. Validate Constraints
        let total_area_blocks = (plate_width * plate_height) as f64;
        let usable_area_ratio = 0.75; // Reserve 25% for logistics
        let max_usable_area = total_area_blocks * usable_area_ratio;
        
        let mut total_facility_area = 0.0;
        let mut total_power = 0.0;

        for req in &required_facilities {
            if let Some(fac) = self.facilities.get(&req.facility_id) {
                // Area = width * height * count
                let area = (fac.width * fac.height) as f64 * req.count;
                total_facility_area += area;
                
                // Power = power * count
                total_power += fac.power_consumption as f64 * req.count;
            }
        }

        // 3. Calculate Scale Factor
        let mut scale_factor = 1.0;
        let mut limiting_factor = None;

        if total_facility_area > max_usable_area {
            let area_scale = max_usable_area / total_facility_area;
            if area_scale < scale_factor {
                scale_factor = area_scale;
                limiting_factor = Some(format!("Space ({:.0}%)", area_scale * 100.0));
            }
        }
        
        // Example Power Budget (Hardcoded for now as we don't have dynamic power source selection yet)
        let power_budget = 5000.0; // Assume a generic base limit
        if total_power > power_budget {
            let power_scale = power_budget / total_power;
            if power_scale < scale_factor {
                scale_factor = power_scale;
                limiting_factor = Some(format!("Power ({:.0}%)", power_scale * 100.0));
            }
        }

        // 4. Apply Scaling
        if scale_factor < 1.0 {
            for req in &mut required_facilities {
                req.count *= scale_factor;
            }
            for val in raw_materials.values_mut() {
                *val *= scale_factor;
            }
            total_power *= scale_factor;
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
            total_power,
            constraint_limited: scale_factor < 1.0,
            limiting_factor,
        })
    }
}
