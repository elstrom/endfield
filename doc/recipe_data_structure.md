# Recipe Data Structure Analysis

Detailed analysis of how production recipes are modeled in the systems.

## 1. Schema Definition
Every recipe follows a consistent JSON-like object Structure:
- `id`: Unique identifier (e.g., `COMPONENT_IRON_CMPT_1`).
- `inputs`: Array of `itemId` and `amount`.
- `outputs`: Array of `itemId` and `amount`.
- `facilityId`: The machine required to run this recipe.
- `craftingTime`: Duration in seconds for one craft cycle.

## 2. Scaling Factors
To calculate items per minute (IPM), we use:
`IPM = (Output Amount / Crafting Time) * 60`

## 3. Complex Recipes (Multi-Output)
Some facilities, like the **Dismantler**, produce multiple different items from a single input:
- **Input**: 1x Bottled Glass Grass
- **Outputs**: 1x Glass Bottle + 1x Plant Liquid
This requires the simulator to account for "byproducts" or secondary outputs which might clog the system if not managed (as noted in the Game8 guide regarding power and flow management).

## 4. Production Interdependencies
Many recipes require items created in previous tiers:
- `Iron Nugget` -> `Iron Component` -> `Advanced Equipment`.
The simulator must be able to calculate the total raw material count by traversing these recipes backwards from the target product.
