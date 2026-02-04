# Spatial and Logistics Specifications

This document defines the spatial and logistics logic for the Arknights: Endfield AIC Simulator.

## 1. Grid System (Plates)
- **Base Grid**: The factory operates on a 2D grid divided into "Blocks".
- **Plate Size**: A standard plate is defined by the user (e.g., 64x64 blocks).
- **Expansion**: The total available area can be expanded (likely by adding more plates) using Stock Bills.

## 2. Facility Geometry
- **Footprint**: Every facility occupies a rectangular area of `W x H` blocks.
- **Orientation**: Facilities can be rotated (0°, 90°, 180°, 270°), which affects the absolute coordinates of their ports.

## 3. Port Mapping (Inputs/Outputs)
- **Local Coordinates**: Each facility has specific "Ports" located at local (x, y) coordinates within its footprint.
- **Port Types**:
  - **Input**: Accepts items from a logistics line.
  - **Output**: Ejects items into a logistics line.
- **Capacity**: Facilities may have multiple inputs and outputs depending on their complexity.

## 4. Logistics (Line Routing)
- **Occupancy**: A single logistics line (Conveyor Belt) segment occupies exactly **1 block**.
- **Connectivity**: Belts must connect an **Output Port** of Facility A to an **Input Port** of Facility B.
- **Pathfinding**: The system must calculate a path through unoccupied blocks to connect ports.

## 5. Optimization Objectives
- **Maximum Sustainable Throughput**: Find the highest production rate physically possible within the given plate, power, and logistics constraints.
- **Route Efficiency**: Minimize belt length to reduce latency and free up space for more facilities.
- **Space Density**: Maximize the ratio of "Productive Area" vs "Logistics Area".
- **Balanced Flow**: Ensure that input supply exactly matches output consumption to prevent belt clogging (Backpressure Management).

## 6. Known Constraints
- **Boundaries**: Facilities and belts cannot be placed outside the current plate area.
- **Collisions**: Two facilities or belts cannot occupy the same block.
- **Throughput Caps**: Production is limited by the `craftingTime` and the physical bandwidth of the conveyors.
- **Constraint-Limited**: Unlike a simple calculator, the layout generation prioritizes what is *possible* over what is *requested*.
