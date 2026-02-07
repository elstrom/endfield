# AIC Facilities Specification

## 1. Logistics Facilities

### Transport Belt
*   **Dimensions:** 1x1
*   **Tier:** 1, 2, 3 (Different speeds)
*   **Throughput Limit:** Defined (e.g., 0.5 for Tier 1)
*   **Logic:** Moves items. Governing speed for connected logistics.

### Splitter / Pipe Splitter
*   **Dimensions:** 1x1
*   **Ports:** 1 Input (Left), 3 Outputs (Right, Top, Bottom)
*   **Tier:** Matches Belt Tier
*   **Throughput Limit:** Inherited from input belt.

### Converger / Pipe Converger
*   **Dimensions:** 1x1
*   **Ports:** 3 Inputs (Left, Top, Bottom), 1 Output (Right)
*   **Tier:** Matches Belt Tier
*   **Throughput Limit:** Inherited from output belt.

### Bridge / Pipe Bridge
*   **Dimensions:** 1x1
*   **Ports:** 
    *   Path 1: Left -> Right
    *   Path 2: Bottom -> Top (Crossing)
*   **Tier:** Matches Belt Tier
*   **Throughput Limit:** Inherited.

### Depot Loader / Unloader
*   **Dimensions:** 3x1
*   **Placement Restriction:** `depot_bus` (Must be placed on the bus line)
*   **Function:** Direct transfer to/from Shared Storage.
*   **Throughput Limit:** Inherited from connected belt.

## 2. Facilities (Production, Power, Hubs)

### Protocol Automation-Core (PAC)
*   **Dimensions:** 9x9
*   **Category:** Facilities
*   **Function:** Central base controller, power generation source (100.0), main connection point.
*   **Ports Configuration:**
    *   **Top / Bottom (Output):** 7 ports each, centered (x: 1-7).
    *   **Left / Right (Input):** 3 ports each, distributed with gaps (y: 1, 4, 7).
*   **Note:** Sub-PAC replaced by Main PAC logic.

### Thermal Bank
*   **Dimensions:** 2x2
*   **Category:** Facilities
*   **Function:** Generates power from fuel items (Originium Ore).
*   **Logic:** Power = Fuel Value * Burn Time.

### Electric Pylon
*   **Dimensions:** 1x1
*   **Category:** Facilities
*   **Function:** Wireless power distribution (Range: 30.0).

### Relay Tower
*   **Dimensions:** 1x1
*   **Category:** Facilities
*   **Function:** Long-range power transmission (Range: 80.0) from PAC/Hub.
