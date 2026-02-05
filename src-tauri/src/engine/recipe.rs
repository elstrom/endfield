use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecipeIngredient {
    pub item_id: String,
    pub amount: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Recipe {
    pub id: String,
    pub name: Option<String>,
    pub inputs: Vec<RecipeIngredient>,
    pub outputs: Vec<RecipeIngredient>,
    pub crafting_time: f32,
    pub facility_id: String,
}
