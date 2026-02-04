# Recipe Data Structure Analysis

Detailed analysis of how production recipes are modeled in the systems.

## 1. Schema Definition
Every recipe follows a consistent JSON-like object Structure:
- `id`: Unique identifier (e.g., `COMPONENT_IRON_CMPT_1`).
- `inputs`: Array of `itemId` and `amount`.
- `outputs`: Array of `itemId` and `amount`.
- `facilityId`: The machine required to run this recipe.
- `craftingTime`: Duration in seconds for one craft cycle.

## 2. Theoretical vs Physical Throughput
- **Theoretical IPM**: `(Output Amount / Crafting Time) * 60`
- **Saturation Point**: The maximum items per minute a machine can handle before conveyors cannot supply inputs fast enough or move outputs away.
- **Logistics Latency**: The time it takes for an item to travel from Facility A to Facility B. While it doesn't reduce total throughput, it creates a "Start-up Delay" and requires internal inventory buffers to stay at 100% activity.

## 3. Complex Recipes & Buffering
Some facilities, like the **Dismantler**, produce multiple different items from a single input:
- **Input**: 1x Bottled Glass Grass
- **Outputs**: 1x Glass Bottle + 1x Plant Liquid
- **Clogging Risk**: If one output line is full, the entire facility stops. The simulator must calculate the **Lowest Common Throughput** across all connected paths.

## 4. Constraint-Based Dependency
The simulator traverses the recipe tree but applies a "Capacity Shaving" logic: if Tier 2 requires 100 IPM but Tier 1 can only provide 50 IPM due to space/power limits, the entire chain is capped at 50 IPM.
