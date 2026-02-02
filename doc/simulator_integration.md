# Simulator Integration Strategy

How to merge game mechanics and old code into the current project.

## 1. Data Merging
- **Assets**: The newly extracted 178 images in `public/images/items` and `public/images/facilities` should be mapped to the `ItemId` and `FacilityId` from the old constants.
- **Facility Metadata**: We should import the `powerConsumption` and `tier` data into the central `config.json` or a specialized `facilities.json` for the Rust engine.

## 2. Engine Logic (Rust)
- The Rust backend (`src-tauri/src/engine`) should implement the `ProductionNode` calculation logic.
- **GPU Optimization**: Use `wgpu` (already in the project) to handle the layout optimization of belts and facilities, similar to how the Game8 guide suggests "planning ahead" to avoid disorganized layouts.

## 3. PAC/Sub-PAC in Simulation
- PAC and Sub-PAC should act as "Global Power Nodes" in the grid.
- Implementation of **Electric Relay Towers** is needed to represent the power coverage mechanic described in the guide.

## 4. Item Database
- The `facilities_data.json` recently created acts as the bridge. It should be expanded with:
  - `power_consumption`: From `old/src/data/facilities.ts`
  - `recipe_ids`: Linking machines to what they can produce.
