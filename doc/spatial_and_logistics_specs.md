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
- **Route Efficiency**: Minimize the number of belt blocks used (minimizes space and latency).
- **Space Density**: Maximize the number of facilities within a given plate.
- **Power Efficiency**: Place facilities to minimize the number of Relay Towers/Pylons needed.
- **Output Maximization**: Arrange everything to meet production targets at 100% efficiency.

## 6. Known Constraints
- **Boundaries**: Facilities and belts cannot be placed outside the current plate area.
- **Collisions**: Two facilities or belts cannot occupy the same block.
- **Goal-Driven**: The layout is generated based on a specific "Final Product" target.
