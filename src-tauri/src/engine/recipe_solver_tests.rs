use crate::engine::recipe_solver::{Recipe, RecipeInput, RecipeOutput, RecipeSolver, ProductionPlan};
use crate::engine::facility::Facility;
use std::collections::HashMap;

#[test]
fn test_solve_unconstrained() {
    let recipes = vec![
        Recipe {
            id: "recipe_iron".to_string(),
            name: Some("Iron Recipe".to_string()),
            inputs: vec![],
            outputs: vec![RecipeOutput { item_id: "iron".to_string(), amount: 1.0 }],
            facility_id: "smelter".to_string(),
            crafting_time: 2.0, // 30 per minute
        }
    ];
    let mut facilities = HashMap::new();
    facilities.insert("smelter".to_string(), Facility {
        id: "smelter".to_string(),
        name: "Smelter".to_string(),
        width: 3,
        height: 3,
        power_consumption: 10.0f32,
        tier: 1,
    });

    let solver = RecipeSolver::new(recipes, facilities);
    
    // Request 300/min. Theoretical: 10 smelters (30/min each)
    let target = vec![("iron".to_string(), 300.0)];
    
    // Plate 100x100 (Huge)
    let plan = solver.solve(target, 100, 100).unwrap();
    
    assert_eq!(plan.constraint_limited, false);
    assert_eq!(plan.required_facilities.len(), 1);
    assert_eq!(plan.required_facilities[0].count, 10.0);
    assert_eq!(plan.total_power, 100.0);
}

#[test]
fn test_solve_space_constrained() {
    let recipes = vec![
        Recipe {
            id: "recipe_iron".to_string(),
            name: Some("Iron Recipe".to_string()),
            inputs: vec![],
            outputs: vec![RecipeOutput { item_id: "iron".to_string(), amount: 1.0 }],
            facility_id: "smelter".to_string(),
            crafting_time: 2.0, // 30 per minute
        }
    ];
    let mut facilities = HashMap::new();
    facilities.insert("smelter".to_string(), Facility {
        id: "smelter".to_string(),
        name: "Smelter".to_string(),
        width: 3,
        height: 3, // Area 9
        power_consumption: 10.0f32,
        tier: 1,
    });

    let solver = RecipeSolver::new(recipes, facilities);
    
    // Request 300/min -> Needs 10 smelters -> Area 90.
    let target = vec![("iron".to_string(), 300.0)];
    
    // Plate 10x10 = 100 blocks. Usable 75% = 75 blocks.
    // 10 smelters need 90 blocks. 90 > 75.
    // Scale factor = 75 / 90 = 0.8333
    // Expected rate = 300 * 0.8333 = 250
    
    let plan = solver.solve(target, 10, 10).unwrap();
    
    assert_eq!(plan.constraint_limited, true);
    assert!(plan.limiting_factor.is_some());
    assert!(plan.limiting_factor.unwrap().contains("Space"));
    
    let actual_rate = plan.actual_rates.get("iron").unwrap();
    assert!(*actual_rate < 300.0);
    assert!(*actual_rate > 240.0 && *actual_rate < 260.0);
}
