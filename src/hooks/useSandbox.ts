import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { debugLog } from "../utils/logger";

export interface PlacedFacility {
    instanceId: string;
    facilityId: string;
    x: number;
    y: number;
    rotation: number;
    port_settings?: { port_id: string, item_id: string }[];
    input_buffer?: { item_id: string, source_port_id?: string, target_port_id?: string, quantity: number }[];
    output_buffer?: { item_id: string, source_port_id?: string, target_port_id?: string, quantity: number, progress?: number }[];
}

export interface LogisticsEdge {
    fromId: string;
    fromPortId: string;
    toId: string;
    toPortId: string;
}

export function useSandbox(appData?: any) {
    const [placedFacilities, setPlacedFacilities] = useState<PlacedFacility[]>([]);
    const [edges, setEdges] = useState<LogisticsEdge[]>([]);
    // Occupany Map: Key="x,y", Value={ instanceId, port? }
    const [occupancyMap, setOccupancyMap] = useState<Map<string, any>>(new Map());
    const [movingFacilityId, setMovingFacilityId] = useState<string | null>(null);
    const [syncTrigger, setSyncTrigger] = useState(0);

    // Refs to hold latest state for sync effect without dependency loop
    const latestFacilitiesRef = useRef(placedFacilities);
    const latestEdgesRef = useRef(edges);

    latestFacilitiesRef.current = placedFacilities;
    latestEdgesRef.current = edges;

    // Sync to Rust Backend (Only on manual trigger)
    useEffect(() => {
        const GRID_SIZE = window.config?.grid_size || 64;
        const currentFacilities = latestFacilitiesRef.current;
        const currentEdges = latestEdgesRef.current;

        // Skip initial empty sync if desired, or keep to clear backend
        debugLog("[useSandbox] Syncing state to Rust. Trigger:", syncTrigger);

        invoke("update_simulation_state", {
            facilities: currentFacilities.map(f => ({
                instance_id: f.instanceId,
                facility_id: f.facilityId,
                x: Math.floor(f.x / GRID_SIZE),
                y: Math.floor(f.y / GRID_SIZE),
                rotation: f.rotation,
                port_settings: f.port_settings || []
            })),
            edges: currentEdges.map(e => ({
                from_instance_id: e.fromId,
                from_port_id: e.fromPortId,
                to_instance_id: e.toId,
                to_port_id: e.toPortId,
                item_id: "placeholder",
                throughput: 1.0
            }))
        })
            .then(() => debugLog("[useSandbox] Sync Success"))
            .catch(err => debugLog("[useSandbox] Sync Failed (ERROR):", err));
    }, [syncTrigger]); // Only re-run when manually triggered

    const isColliding = useCallback((pixelX: number, pixelY: number, widthInPixels: number, heightInPixels: number) => {
        const GRID_SIZE = window.config?.grid_size || 64;

        const startX = Math.floor(pixelX / GRID_SIZE);
        const startY = Math.floor(pixelY / GRID_SIZE);
        const w = Math.ceil(widthInPixels / GRID_SIZE);
        const h = Math.ceil(heightInPixels / GRID_SIZE);

        for (let ix = 0; ix < w; ix++) {
            for (let iy = 0; iy < h; iy++) {
                const key = `${startX + ix},${startY + iy}`;
                const occupant = occupancyMap.get(key);
                const occupantId = occupant && typeof occupant === 'object' ? occupant.instanceId : occupant;

                // If cell is occupied AND it's not the one we are currently moving
                if (occupantId && occupantId !== movingFacilityId) {
                    return true;
                }
            }
        }
        return false;
    }, [occupancyMap, movingFacilityId]);

    const addFacility = useCallback((facilityId: string, x: number, y: number, rotation: number = 0) => {
        const newFacility: PlacedFacility = {
            instanceId: Math.random().toString(36).substr(2, 9),
            facilityId,
            x,
            y,
            rotation,
        };
        setPlacedFacilities((prev) => [...prev, newFacility]);
        setSyncTrigger(prev => prev + 1);
        return newFacility.instanceId;
    }, []);

    // Rebuild Occupancy Map whenever placedFacilities change
    useEffect(() => {
        const GRID_SIZE = window.config?.grid_size || 64;
        const newMap = new Map<string, any>();
        const appData = (window as any).appData;

        if (!appData?.facilities) return;

        placedFacilities.forEach(pf => {
            const meta = appData.facilities.find((f: any) => f.id === pf.facilityId);
            if (!meta) return;

            const startX = Math.floor(pf.x / GRID_SIZE);
            const startY = Math.floor(pf.y / GRID_SIZE);
            const rot = pf.rotation || 0;
            const isRotated = rot % 180 === 90;
            const w = isRotated ? (meta.height || 1) : (meta.width || 1);
            const h = isRotated ? (meta.width || 1) : (meta.height || 1);

            // 1. Fill Footprint
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    newMap.set(`${startX + x},${startY + y}`, { instanceId: pf.instanceId });
                }
            }

            // 2. Map Ports specifically
            if (meta.ports) {
                meta.ports.forEach((port: any) => {
                    // Calculate rotated port position
                    let px = port.x;
                    let py = port.y;
                    const r = rot % 360;

                    if (r === 90) { px = (meta.height || 1) - 1 - port.y; py = port.x; }
                    else if (r === 180) { px = (meta.width || 1) - 1 - port.x; py = (meta.height || 1) - 1 - port.y; }
                    else if (r === 270) { px = port.y; py = (meta.width || 1) - 1 - port.x; }

                    const key = `${startX + px},${startY + py}`;
                    const entry = newMap.get(key) || { instanceId: pf.instanceId, ports: [] };

                    const portData = {
                        id: port.id,
                        type: port.type,
                        direction: port.direction
                    };

                    if (!entry.ports) entry.ports = [];
                    entry.ports.push(portData);
                    // Port info for grid-based interaction (convenience)
                    entry.port = portData;

                    newMap.set(key, entry);
                });
            }
        });
        setOccupancyMap(newMap);

        // 3. AUTOMATIC TOPOLOGY DISCOVERY
        // Find adjacent ports and create edges
        const newEdges: LogisticsEdge[] = [];
        placedFacilities.forEach(pf => {
            const meta = appData.facilities.find((f: any) => f.id === pf.facilityId);
            if (!meta || !meta.ports) return;

            const startX = Math.floor(pf.x / GRID_SIZE);
            const startY = Math.floor(pf.y / GRID_SIZE);
            const rot = pf.rotation || 0;

            meta.ports.forEach((port: any) => {
                if (port.type !== 'output') return;

                // Rotated port position
                let px = port.x;
                let py = port.y;
                const r = rot % 360;
                if (r === 90) { px = (meta.height || 1) - 1 - port.y; py = port.x; }
                else if (r === 180) { px = (meta.width || 1) - 1 - port.x; py = (meta.height || 1) - 1 - port.y; }
                else if (r === 270) { px = port.y; py = (meta.width || 1) - 1 - port.x; }

                // Check neighbor according to direction
                let nx = startX + px;
                let ny = startY + py;

                // Directions are relative to facility orientation? 
                // In database.json, direction is "bottom", "left" etc for the default orientation.
                // We need the ACTUAL world direction of the port.
                let worldDir = port.direction;
                const directions = ["top", "right", "bottom", "left"];
                if (rot !== 0) {
                    const idx = directions.indexOf(port.direction);
                    if (idx !== -1) {
                        worldDir = directions[(idx + (rot / 90)) % 4];
                    }
                }

                if (worldDir === 'top') ny--;
                else if (worldDir === 'bottom') ny++;
                else if (worldDir === 'left') nx--;
                else if (worldDir === 'right') nx++;

                const neighbor = newMap.get(`${nx},${ny}`);
                if (neighbor && neighbor.ports) {
                    const inputPort = neighbor.ports.find((p: any) => p.type === 'input');
                    if (inputPort) {
                        console.log(`[Goal] Discovery: ${pf.instanceId}:${port.id} -> ${neighbor.instanceId}:${inputPort.id}`);
                        newEdges.push({
                            fromId: pf.instanceId,
                            fromPortId: port.id,
                            toId: neighbor.instanceId,
                            toPortId: inputPort.id
                        });
                    }
                }
            });
        });

        // Update edges state if changed
        setEdges(prev => {
            const isDifferent = JSON.stringify(prev) !== JSON.stringify(newEdges);
            if (isDifferent) {
                setTimeout(() => setSyncTrigger(t => t + 1), 0); // Trigger sync to Rust
                return newEdges;
            }
            return prev;
        });
    }, [placedFacilities, appData]);

    const rotateFacility = useCallback((instanceId: string) => {
        setPlacedFacilities((prev) => prev.map(f => {
            if (f.instanceId === instanceId) {
                // Rotate 90 degrees clockwise (0 -> 90 -> 180 -> 270 -> 0)
                return { ...f, rotation: (f.rotation + 90) % 360 };
            }
            return f;
        }));
        setSyncTrigger(prev => prev + 1);
    }, []);

    const clearBoard = useCallback(() => {
        setPlacedFacilities([]);
        setEdges([]);
        setOccupancyMap(new Map());
        setSyncTrigger(prev => prev + 1);
    }, []);

    const applyLayout = useCallback((layout: any[]) => {
        const GRID_SIZE = window.config?.grid_size || 64;
        const newFacilities = layout.map(f => ({
            instanceId: Math.random().toString(36).substr(2, 9),
            facilityId: f.facility_id,
            x: f.x * GRID_SIZE, // Convert grid cells to pixels
            y: f.y * GRID_SIZE,
            rotation: f.rotation,
        }));
        setPlacedFacilities(newFacilities);
        setEdges([]);
        setSyncTrigger(prev => prev + 1);
        // content of occupiedCells will update via useEffect
    }, []);

    const updateFacility = useCallback((instanceId: string, updates: Partial<PlacedFacility>) => {
        setPlacedFacilities(prev => {
            const next = prev.map(f => f.instanceId === instanceId ? { ...f, ...updates } : f);
            return next;
        });
        setSyncTrigger(prev => prev + 1);
    }, []);

    const removeFacility = useCallback((instanceId: string) => {
        setPlacedFacilities(prev => prev.filter(f => f.instanceId !== instanceId));
        setEdges(prev => prev.filter(e => e.fromId !== instanceId && e.toId !== instanceId));
        setSyncTrigger(prev => prev + 1);
        debugLog("[useSandbox] Removed Facility:", instanceId);
    }, []);

    const stepSimulation = useCallback(async () => {
        try {
            const updatedFacilities = await invoke<any[]>("tick_simulation");
            // Merge updates
            const mapped = updatedFacilities.map((f: any) => ({
                instanceId: f.instance_id,
                facilityId: f.facility_id,
                x: f.x * (window.config?.grid_size || 64),
                y: f.y * (window.config?.grid_size || 64),
                rotation: f.rotation,
                port_settings: f.port_settings,
                input_buffer: f.input_buffer,
                output_buffer: f.output_buffer
            }));

            setPlacedFacilities(mapped);
        } catch (e) {
            console.error(e);
        }
    }, []);

    return {
        placedFacilities,
        edges,
        occupancyMap,
        addFacility,
        updateFacility,
        setMovingFacilityId,
        isColliding,
        rotateFacility,
        applyLayout,
        clearBoard,
        removeFacility,
        stepSimulation
    };
}
