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

export function useSandbox() {
    const [placedFacilities, setPlacedFacilities] = useState<PlacedFacility[]>([]);
    const [edges, setEdges] = useState<LogisticsEdge[]>([]);

    // Sync to Rust Backend
    useEffect(() => {
        debugLog("[useSandbox] Syncing state to Rust. Count:", placedFacilities.length);
        invoke("update_simulation_state", {
            facilities: placedFacilities.map(f => ({
                instance_id: f.instanceId,
                facility_id: f.facilityId,
                x: Math.floor(f.x / 32),
                y: Math.floor(f.y / 32),
                rotation: f.rotation
            })),
            edges: edges.map(e => ({
                from_instance_id: e.fromId,
                to_instance_id: e.toId,
                item_id: "placeholder", // Will be dynamic later
                throughput: 1.0
            }))
        })
            .then(() => debugLog("[useSandbox] Sync Success"))
            .catch(err => debugLog("[useSandbox] Sync Failed (ERROR):", err));
    }, [placedFacilities, edges]);

    const isColliding = useCallback((x: number, y: number, w: number, h: number, facilitiesData: any[]) => {
        for (const pf of placedFacilities) {
            const meta = facilitiesData.find(f => f.id === pf.facilityId);
            if (!meta) continue;

            const existingX = pf.x;
            const existingY = pf.y;
            const existingW = meta.width * 32;
            const existingH = meta.height * 32;

            const newX = x;
            const newY = y;
            const newW = w * 32;
            const newH = h * 32;

            if (newX < existingX + existingW &&
                newX + newW > existingX &&
                newY < existingY + existingH &&
                newY + newH > existingY) {
                return true;
            }
        }
        return false;
    }, [placedFacilities]);

    const addFacility = useCallback((facilityId: string, x: number, y: number) => {
        debugLog("[useSandbox] addFacility called:", facilityId, x, y);
        const newFacility: PlacedFacility = {
            instanceId: Math.random().toString(36).substr(2, 9),
            facilityId,
            x,
            y,
            rotation: 0,
        };
        setPlacedFacilities((prev) => {
            debugLog("[useSandbox] Updating placedFacilities state. Prev count:", prev.length);
            return [...prev, newFacility];
        });
        debugLog("[useSandbox] Facility added to state (queued):", newFacility.instanceId);
        return newFacility.instanceId;
    }, []);

    const addEdge = useCallback((fromId: string, toId: string) => {
        if (fromId === toId) return;
        // Avoid duplicate edges
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
    }, []);

    const applyLayout = useCallback((layout: any[]) => {
        const newFacilities = layout.map(f => ({
            instanceId: Math.random().toString(36).substr(2, 9),
            facilityId: f.facility_id,
            x: f.x * 32, // Convert grid cells to pixels
            y: f.y * 32,
            rotation: f.rotation,
        }));
        setPlacedFacilities(newFacilities);
        setEdges([]); // Clear edges for now as layout generator doesn't output edges yet
    }, []);

    return {
        placedFacilities,
        edges,
        addFacility,
        addEdge,
        isColliding,
        rotateFacility,
        applyLayout,
        clearBoard
    };
}
