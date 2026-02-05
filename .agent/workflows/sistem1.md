---
description: old_codebase_analysis
---

# Old Codebase Analysis (`/old`)

Analysis of the previous project structure and logic.

## 1. Data Structure
The old project followed a strictly typed approach to game data:
- **`src/data/facilities.ts`**: Defines machine properties like `powerConsumption` (e.g., Refining Unit uses 5 units, Thickener uses 50) and `tier`.
- **`src/data/recipes.ts`**: Massive registry of production formulas (inputs, outputs, crafting time).
- **`src/types/constants.ts`**: Likely contains enums for all `ItemId`, `FacilityId`, and `RecipeId`.

## 2. Calculation Logic
The core "brains" reside in the production tree types:
- **`ProductionNode`**: A recursive tree structure where each node represents an item to be produced, its required facility, count, and dependencies.
- **Cycle Detection**: The code specifically handles "Production Cycles" (using `DetectedCycle` type). This is crucial for factories where a product is looped back as a catalyst or secondary ingredient.
- **Graph Representation**: Uses `ProductionDependencyGraph` with nodes and edges, allowing visual rendering of the factory flow.

## 3. Frontend Implementation
- **Vite + React**: The UI was built using React with `i18next` for localization.
- **Asset Loading**: Facilities icons were expected in `images/facilities/${id}.png`.

## 4. Observations for Migration
- The `powerConsumption` values in `facilities.ts` are essential for the new simulator.
- The `ProductionNode` logic can likely be ported or adapted to the Rust backend for faster calculation of large-scale factories.
- The `RecipeId` and `ItemId` mapping must remain consistent to avoid breaking data links.
