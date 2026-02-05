import { useRef, useEffect, useState } from "react";
import * as PIXI from "pixi.js";
import { invoke } from "@tauri-apps/api/core";
import { useSandbox } from "../hooks/useSandbox";

declare global {
    interface Window {
        selectedFacilityId: string | null;
        addFacility: (id: string, x: number, y: number) => void;
        addEdge: (from: string, to: string) => void;
        isColliding: (x: number, y: number, w: number, h: number, data: any[]) => boolean;
        appData: any;
        placedFacilities: any[];
        config: any;
    }
}

export function Viewport() {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const worldRef = useRef<PIXI.Container | null>(null);
    const [appData, setAppData] = useState<{ facilities: any[], items: any[], recipes: any[], config: any, geometry: any[] }>({
        facilities: [],
        items: [],
        recipes: [],
        config: null,
        geometry: []
    });
    const { placedFacilities, edges, addFacility, addEdge, isColliding, rotateFacility } = useSandbox();
    const [selectedFacilityId] = useState<string | null>(null); // Kept for future potential selection logic, but currently logic is hidden

    // Load Data
    useEffect(() => {
        invoke("get_app_data")
            .then((data: any) => {
                console.log("App data loaded:", data);
                setAppData(data);
            })
            .catch(err => console.error("Failed to load app data:", err));
    }, []);

    const config = appData.config;
    const GRID_SIZE = config?.simulation?.grid_size || 32;

    // Helper: Transform port coordinates based on rotation
    const getRotatedPortPosition = (port: any, width: number, height: number, rotation: number) => {
        let { x, y } = port;
        const rot = rotation % 360;

        if (rot === 90) {
            return { x: height - 1 - y, y: x };
        } else if (rot === 180) {
            return { x: width - 1 - x, y: height - 1 - y };
        } else if (rot === 270) {
            return { x: y, y: width - 1 - x };
        }
        return { x, y };
    };

    // Scene Rendering
    useEffect(() => {
        if (!containerRef.current || !appRef.current || !worldRef.current || !config) return;
        const world = worldRef.current;

        let facilitiesLayer = world.children.find(c => c.label === "facilities") as PIXI.Container;
        if (!facilitiesLayer) {
            facilitiesLayer = new PIXI.Container();
            facilitiesLayer.label = "facilities";
            world.addChild(facilitiesLayer);
        }

        let topologyLayer = world.children.find(c => c.label === "topology") as PIXI.Graphics;
        if (!topologyLayer) {
            topologyLayer = new PIXI.Graphics();
            topologyLayer.label = "topology";
            world.addChildAt(topologyLayer, 0);
        }

        const renderScene = async () => {
            facilitiesLayer.removeChildren();
            topologyLayer.clear();

            // Draw Connections
            // Fallback color if config not ready
            const edgeColor = config.visuals?.colors?.topology_edge ? parseInt(config.visuals.colors.topology_edge) : 0x000000;
            const edgeAlpha = config.visuals?.opacity?.topology || 1;

            topologyLayer.lineStyle(2, edgeColor, edgeAlpha);
            for (const edge of edges) {
                const from = placedFacilities.find(f => f.instanceId === edge.fromId);
                const to = placedFacilities.find(f => f.instanceId === edge.toId);
                if (!from || !to) continue;

                const fromMeta = appData.facilities.find(f => f.id === from.facilityId);
                const toMeta = appData.facilities.find(f => f.id === to.facilityId);

                const fromX = from.x + (fromMeta?.width || 1) * GRID_SIZE / 2;
                const fromY = from.y + (fromMeta?.height || 1) * GRID_SIZE / 2;
                const toX = to.x + (toMeta?.width || 1) * GRID_SIZE / 2;
                const toY = to.y + (toMeta?.height || 1) * GRID_SIZE / 2;

                topologyLayer.moveTo(fromX, fromY).lineTo(toX, toY);
            }

            // Draw Facilities
            for (const pf of placedFacilities) {
                const meta = appData.facilities.find(f => f.id === pf.facilityId);
                // In new database.json, geometry is embedded in meta (facilities list), so we use meta directly or look for separate geometry if structure preserved
                // Based on backend loader, facilities ARE the geometry source now.
                const geom = meta;

                if (!meta) continue;

                const iconPath = `/images/facilities/${pf.facilityId}.png`;
                try {
                    // Try to load icon, if fails draw rect
                    // Note: In real production, pre-load assets. Here we do async load which might flicker but is simple.
                    const texture = await PIXI.Assets.load(iconPath).catch(() => null);

                    if (texture) {
                        const sprite = new PIXI.Sprite(texture);

                        // Apply rotation
                        const rotatedWidth = (pf.rotation === 90 || pf.rotation === 270) ? meta.height : meta.width;
                        const rotatedHeight = (pf.rotation === 90 || pf.rotation === 270) ? meta.width : meta.height;

                        sprite.width = rotatedWidth * GRID_SIZE;
                        sprite.height = rotatedHeight * GRID_SIZE;
                        sprite.x = pf.x;
                        sprite.y = pf.y;
                        sprite.anchor.set(0.5);
                        sprite.x += sprite.width / 2;
                        sprite.y += sprite.height / 2;
                        sprite.rotation = (pf.rotation * Math.PI) / 180;
                        facilitiesLayer.addChild(sprite);
                    } else {
                        throw new Error("Texture load failed");
                    }
                } catch (e) {
                    // Fallback Rect
                    const rect = new PIXI.Graphics();
                    rect.beginFill(0xeeeeee);
                    rect.drawRect(pf.x, pf.y, meta.width * GRID_SIZE, meta.height * GRID_SIZE);
                    rect.endFill();
                    facilitiesLayer.addChild(rect);
                }

                // Draw Ports (overlay on top)
                if (geom?.ports) {
                    for (const port of geom.ports) {
                        const rotatedPos = getRotatedPortPosition(port, meta.width, meta.height, pf.rotation);
                        const portX = pf.x + rotatedPos.x * GRID_SIZE + GRID_SIZE / 2;
                        const portY = pf.y + rotatedPos.y * GRID_SIZE + GRID_SIZE / 2;

                        const portCircle = new PIXI.Graphics();
                        const portColor = port.type === 'input' ? 0x22c55e : 0xef4444;
                        portCircle.beginFill(portColor, 0.8);
                        portCircle.drawCircle(portX, portY, 4);
                        portCircle.endFill();
                        facilitiesLayer.addChild(portCircle);
                    }
                }
            }
        };

        renderScene();
    }, [placedFacilities, edges, appData, config]);

    // Application Setup
    useEffect(() => {
        if (!containerRef.current || !config) return;

        const init = async () => {
            const app = new PIXI.Application();
            await app.init({
                resizeTo: containerRef.current!,
                backgroundColor: 0x2b2b2b, // Blender-like Dark Grey
                antialias: true,
                resolution: window.devicePixelRatio || 1,
            });

            containerRef.current!.appendChild(app.canvas);
            appRef.current = app;

            const world = new PIXI.Container();
            world.label = "world";
            app.stage.addChild(world);
            worldRef.current = world;

            const grid = new PIXI.Graphics();
            // Darker grid lines for subtle "Engine" feel
            grid.setStrokeStyle({ width: 1, color: 0x3d3d3d, alpha: 1 });

            // Default to 64x64 tiles if not specified
            const tiles = config.world_size_tiles || 64;
            const boardSize = tiles * GRID_SIZE;

            // Draw Major/Minor grid lines simulation
            // Just standard lines for now, but dark on dark
            for (let x = 0; x <= boardSize; x += GRID_SIZE) grid.moveTo(x, 0).lineTo(x, boardSize);
            for (let y = 0; y <= boardSize; y += GRID_SIZE) grid.moveTo(0, y).lineTo(boardSize, y);
            grid.stroke();

            // Thicker border for the world bounds
            grid.setStrokeStyle({ width: 2, color: 0x505050, alpha: 1 });
            grid.drawRect(0, 0, boardSize, boardSize);
            grid.stroke();

            world.addChildAt(grid, 0);

            // Center the camera initially
            // world.x = (app.screen.width - boardSize) / 2;
            // world.y = (app.screen.height - boardSize) / 2;

            // Interaction Handlers (Zoom, Pan)
            let isDragging = false;
            let lastPos = { x: 0, y: 0 };

            app.canvas.addEventListener("mousedown", (e) => {
                if (e.button === 1 || (e.button === 0 && e.altKey)) {
                    isDragging = true;
                    lastPos = { x: e.clientX, y: e.clientY };
                }
                // Other interactions (place/connect) removed for now as requested UI is "clean"
                // User can add back specific interaction modes if they want "sandbox" controls.
                // For now, it just VIEWs the grid.
            });

            window.addEventListener("mousemove", (e) => {
                if (isDragging) {
                    world.x += e.clientX - lastPos.x;
                    world.y += e.clientY - lastPos.y;
                    lastPos = { x: e.clientX, y: e.clientY };
                }
            });

            window.addEventListener("mouseup", () => {
                isDragging = false;
            });

            app.canvas.addEventListener("wheel", (e) => {
                e.preventDefault();
                const zoom = Math.exp(-e.deltaY * 0.001);
                const mousePos = new PIXI.Point(e.clientX, e.clientY);
                const localPos = world.toLocal(mousePos);
                const newScale = Math.min(Math.max(world.scale.x * zoom, 0.1), 5.0);
                world.scale.set(newScale);
                const newMouseStagePos = world.toGlobal(localPos);
                world.x -= (newMouseStagePos.x - mousePos.x);
                world.y -= (newMouseStagePos.y - mousePos.y);
            }, { passive: false });
        };

        if (!appRef.current) {
            init();
        }

        return () => { if (appRef.current) appRef.current.destroy(true, { children: true, texture: true }); };
    }, [config]);

    // Global Window exposure for legacy hooks/debug if needed
    useEffect(() => {
        window.selectedFacilityId = selectedFacilityId;
        window.addFacility = addFacility;
        window.addEdge = addEdge;
        window.isColliding = isColliding;
        window.appData = appData;
        window.placedFacilities = placedFacilities;
        window.config = config;
    }, [selectedFacilityId, addFacility, addEdge, isColliding, appData, placedFacilities, config]);

    if (!config) return <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300 font-bold">LOADING SYSTEM DATA...</div>;

    return (
        <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-100">
            {/* Clean Viewport, no UI overlays */}
        </div>
    );
}
