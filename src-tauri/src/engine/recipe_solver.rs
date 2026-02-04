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
    pub required_facilities: Vec<FacilityRequirement>,
    pub raw_materials: HashMap<String, f64>, // item_id -> amount per minute
    pub total_power: f64,
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

    /// Solve production requirements for target items
    pub fn solve(
        &self,
        target_items: Vec<(String, f64)>, // (item_id, rate_per_minute)
    ) -> Result<ProductionPlan, String> {
        let mut required_facilities: Vec<FacilityRequirement> = Vec::new();
        let mut item_demands: HashMap<String, f64> = HashMap::new();
        let mut processed_items: HashSet<String> = HashSet::new();
        let mut raw_materials: HashMap<String, f64> = HashMap::new();

        // Initialize with target demands
        for (item_id, rate) in &target_items {
            item_demands.insert(item_id.clone(), *rate);
        }

        // Process items in dependency order (simple DFS for now)
        let mut stack: Vec<String> = target_items.iter().map(|(id, _)| id.clone()).collect();

        while let Some(item_id) = stack.pop() {
            if processed_items.contains(&item_id) {
                continue;
            }

            let demand = *item_demands.get(&item_id).unwrap_or(&0.0);
            if demand == 0.0 {
                continue;
            }

            // Find recipe for this item
            let recipes = self.find_recipes_for_item(&item_id);
            if recipes.is_empty() {
                // This is a raw material
                raw_materials.insert(item_id.clone(), demand);
                processed_items.insert(item_id.clone());
                continue;
            }

            // Select first recipe (can be improved with heuristics)
            let recipe = recipes[0];
            
            // Calculate facility count needed
            let output = recipe.outputs.iter().find(|o| o.item_id == item_id).unwrap();
            let production_rate = Self::calc_rate(output.amount, recipe.crafting_time);
            let facility_count = if production_rate > 0.0 {
                demand / production_rate
            } else {
                0.0
            };

            // Get facility type
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
                let input_rate = Self::calc_rate(input.amount, recipe.crafting_time) * facility_count;
                *item_demands.entry(input.item_id.clone()).or_insert(0.0) += input_rate;
                stack.push(input.item_id.clone());
            }

            processed_items.insert(item_id);
        }

        // Calculate total power
        let total_power: f64 = required_facilities.iter()
            .filter_map(|req| {
                self.facilities.get(&req.facility_id).map(|f| {
                    f.power_consumption as f64 * req.count
                })
            })
            .sum();

        Ok(ProductionPlan {
            target_items: target_items.iter().map(|(id, _)| id.clone()).collect(),
            required_facilities,
            raw_materials,
            total_power,
        })
    }
}
