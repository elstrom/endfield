---
description: constraint_limited_optimizer
---

# Constraint-Limited Optimizer (Paradigm Shift)

This document outlines the core optimization logic of the ENDfield Sandbox, moving away from simple "Target Calculators" toward a "Constraint-Based Physical Simulator".

## 1. The Realism Problem
In Arknights: Endfield, production is not infinite. A user might "want" 1,000,000 units/second, but physics forbids it. The optimizer must prioritize **Physical Feasibility** over **Target Fulfillment**.

## 2. Key Constraints (The "Bottlenecks")
The solver must calculate the **Maximum Sustainable Throughput** by evaluating these hard limits:

### A. Raw Material Supply
- Mines have a fixed yield based on regional development and power tier.
- Production cannot exceed the aggregate extraction rate of upstream materials.

### B. Spatial Geometry (The "4-Block Room" Problem)
- Facilities have a physical footprint ($W \times H$).
- The available area (Plate) defines the maximum number of facilities that can *physically* exist.
- Logistics belts also occupy space; a dense layout might be impossible if there's no room for conveyors.

### C. Temporal Delay (Crafting Time)
- Every recipe has a cycle time ($T$).
- Real throughput $\text{IPM} = \frac{\text{BatchSize}}{T} \times 60$.
- Logistics latency (belt travel time) adds "buffer" requirements but doesn't change the theoretical maximum if the line is saturated.

### D. Power Budget
- PAC/Thermal Banks have a maximum output.
- Every active machine adds a load.
- If $\sum \text{Consumption} > \text{Generation}$, the entire topology fails.

## 3. The Optimization Workflow (Bottom-Up)
Instead of asking "How many machines do I need for X rate?", the system asks:
1. **Geometric Permutation**: Generate thousands of valid layouts within the Plate bounds.
2. **Throughput Validation**: For each layout, calculate the maximum possible output given the power and connection topology.
3. **Filtering**: Discard layouts that are physically impossible or cause bottlenecks.
4. **Ranking (Top 5)**: Present the layouts that achieve the highest *sustainable* rate across the desired items.

## 4. Why "Input Rate" is a Suggestion, Not a Goal
The user-provided "Input Rate" in the UI acts as a **Priority Filter**, not a hard requirement.
- If a user asks for 60 units/min but the area only fits 3 units/min, the system will return layouts that maximize output up to that 3 units/min limit, rather than erroring out.
- The UI must clearly show that a layout is "Operating at X% of requested capacity due to space/power constraints".
