# Logistics Animation and Transfer Logic Refinement

This document serves as the implementation specification for the logistics item movement and animation system to ensure consistency and prevent "forgetting" critical logic.

## 1. Visual Specification
- **Port Colors**:
  - **Output Port**: Red (`0xff0000`) - The source where items exit a facility.
  - **Input Port**: Green (`0x00ff00`) - The destination where items enter a facility.
- **Animation Path**:
  - Items must visualize as moving from the **Output Port** of the source facility (Red) toward the **Input Port** of the destination facility (Green) through the belt path.
  - Internal movement within a facility (from Input Port to Output Port) should also be visualized using interpolation.

## 2. Logic & Speed
- **Global Belt Speed**: `0.5 unit/s`.
  - Logic: Every 1 unit distance (1 grid block) takes exactly **2 seconds** to traverse.
- **Progress Calculation (Backend)**:
  - `progress += dt * 0.5`
  - A full crossing (Input to Output) is completed when `progress` reach `1.0`.

## 3. Transfer & Transit Mechanics
- **State Integrity**: An item is considered "in Transit" while it is moving between ports.
- **Timing**:
  - Item remains in the Source Facility's `output_buffer` while its `progress` is `< 1.0`.
  - Once `progress >= 1.0` AND the Destination Facility has space (`input_buffer.len() < limit`), the item is transferred.
  - **Critical Rule**: An item is **NOT** added to the destination facility's data until it has physically (mathematically) completed its travel along the belt to the target In Port.
  - If belts are individual 1x1 facilities, the item moves: `Out(A) -> In(Belt1) -> Out(Belt1) -> In(Belt2) -> ... -> In(B)`.

## 4. Implementation Steps
1.  **Backend (`logistics_engine.rs`)**:
    - Adjust `dt` multiplier from `2.0` to `0.5`.
    - Ensure `output_buffer` logic correctly holds the item until full progress.
2.  **Frontend (`Viewport.tsx`)**:
    - Fix port colors: `port.type === 'output' ? 0xff0000 : 0x00ff00`.
    - Fix Item `startPos`: For 1x1 belts, `startPos` should be the **Input Port** coordinate, and `endPos` should be the **Output Port** coordinate.
    - For larger facilities, `startPos` remains the facility center (or a internal production progress logic) ending at the Output Port.
3.  **Path Visualization**:
    - While an item is in a belt segment, it should move from the "In" edge to the "Out" edge of that segment.
