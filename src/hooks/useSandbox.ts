import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { debugLog } from "../utils/logger";

export interface PlacedFacility {
    instanceId: string;
    facilityId: string;
    x: number;
    y: number;
    rotation: number;
}

export interface LogisticsEdge {
    fromId: string;
    toId: string;
}

export function useSandbox(appData?: any) {
    const [placedFacilities, setPlacedFacilities] = useState<PlacedFacility[]>([]);
    const [edges, setEdges] = useState<LogisticsEdge[]>([]);
    // Occupany Map: Key="x,y", Value={ instanceId, port? }
    const [occupancyMap, setOccupancyMap] = useState<Map<string, any>>(new Map());
    const [movingFacilityId, setMovingFacilityId] = useState<string | null>(null);

    // Sync to Rust Backend
    useEffect(() => {
        const GRID_SIZE = window.config?.grid_size || 64;
        debugLog("[useSandbox] Syncing state to Rust. Count:", placedFacilities.length);
        invoke("update_simulation_state", {
            facilities: placedFacilities.map(f => ({
                instance_id: f.instanceId,
                facility_id: f.facilityId,
                x: Math.floor(f.x / GRID_SIZE),
                y: Math.floor(f.y / GRID_SIZE),
                rotation: f.rotation
            })),
            edges: edges.map(e => ({
                from_instance_id: e.fromId,
                to_instance_id: e.toId,
                item_id: "placeholder",
                throughput: 1.0
            }))
        })
            .then(() => debugLog("[useSandbox] Sync Success"))
            .catch(err => debugLog("[useSandbox] Sync Failed (ERROR):", err));
    }, [placedFacilities, edges]);

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
                    newMap.set(key, {
                        instanceId: pf.instanceId,
                        port: {
                            id: port.id,
                            type: port.type,
                            direction: port.direction
                        }
                    });
                });
            }
        });
        setOccupancyMap(newMap);
    }, [placedFacilities, appData]);

    const addEdge = useCallback((fromId: string, toId: string) => {
        if (fromId === toId) return;
        setEdges((prev) => {
            if (prev.find(e => e.fromId === fromId && e.toId === toId)) return prev;
            return [...prev, { fromId, toId }];
        });
    }, []);

    const rotateFacility = useCallback((instanceId: string) => {
        setPlacedFacilities((prev) => prev.map(f => {
            if (f.instanceId === instanceId) {
                // Rotate 90 degrees clockwise (0 -> 90 -> 180 -> 270 -> 0)
                return { ...f, rotation: (f.rotation + 90) % 360 };
            }
            return f;
        }));
    }, []);

    const clearBoard = useCallback(() => {
        setPlacedFacilities([]);
        setEdges([]);
        setOccupancyMap(new Map());
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
        // content of occupiedCells will update via useEffect
    }, []);

    const updateFacility = useCallback((instanceId: string, updates: Partial<PlacedFacility>) => {
        setPlacedFacilities(prev => {
            const next = prev.map(f => f.instanceId === instanceId ? { ...f, ...updates } : f);
            return next;
        });
    }, []);

    const removeFacility = useCallback((instanceId: string) => {
        setPlacedFacilities(prev => prev.filter(f => f.instanceId !== instanceId));
        setEdges(prev => prev.filter(e => e.fromId !== instanceId && e.toId !== instanceId));
        debugLog("[useSandbox] Removed Facility:", instanceId);
    }, []);

    return {
        placedFacilities,
        edges,
        occupancyMap,
        addFacility,
        updateFacility,
        setMovingFacilityId,
        addEdge,
        isColliding,
        rotateFacility,
        applyLayout,
        clearBoard,
        removeFacility
    };
}
