import { useRef, useEffect, useState } from "react";
import * as PIXI from "pixi.js";
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
        viewportState?: any; // Debug access
    }
}

export function Viewport({ appData }: { appData: any }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const worldRef = useRef<PIXI.Container | null>(null);

    const { placedFacilities, edges, addFacility, addEdge, isColliding } = useSandbox();
    const [selectedFacilityId] = useState<string | null>(null);

    const config = appData?.config;
    const GRID_SIZE = config?.grid_size || 64;

    // Helper: Transform port coordinates based on rotation
    const getRotatedPortPosition = (port: any, width: number, height: number, rotation: number) => {
        let { x, y } = port;
        const rot = rotation % 360;
        if (rot === 90) return { x: height - 1 - y, y: x };
        if (rot === 180) return { x: width - 1 - x, y: height - 1 - y };
        if (rot === 270) return { x: y, y: width - 1 - x };
        return { x, y };
    };

    // Global State Sync
    useEffect(() => {
        window.selectedFacilityId = selectedFacilityId;
        window.addFacility = addFacility;
        window.addEdge = addEdge;
        window.isColliding = isColliding;
        window.appData = appData;
        window.placedFacilities = placedFacilities;
        window.config = config;
    }, [selectedFacilityId, addFacility, addEdge, isColliding, appData, placedFacilities, config]);

    // Compass Overlay State
    const [compassRotation, setCompassRotation] = useState(0);
    useEffect(() => {
        const handleUpdate = (e: any) => setCompassRotation(e.detail.rotation);
        window.addEventListener('viewport-update', handleUpdate);
        return () => window.removeEventListener('viewport-update', handleUpdate);
    }, []);

    // Scene Rendering (Facilities & Topology)
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
            world.addChildAt(topologyLayer, 0); // Below facilities
        }

        const renderScene = async () => {
            facilitiesLayer.removeChildren();
            topologyLayer.clear();

            const edgeColor = config.visuals?.colors?.topology_edge ? parseInt(config.visuals.colors.topology_edge.replace('#', '0x')) : 0x000000;
            const edgeAlpha = config.visuals?.opacity?.topology || 1;

            topologyLayer.lineStyle(2, edgeColor, edgeAlpha);
            for (const edge of edges) {
                const from = placedFacilities.find(f => f.instanceId === edge.fromId);
                const to = placedFacilities.find(f => f.instanceId === edge.toId);
                if (!from || !to) continue;

                const fromMeta = appData.facilities.find((f: any) => f.id === from.facilityId);
                const toMeta = appData.facilities.find((f: any) => f.id === to.facilityId);

                const fromX = from.x + (fromMeta?.width || 1) * GRID_SIZE / 2;
                const fromY = from.y + (fromMeta?.height || 1) * GRID_SIZE / 2;
                const toX = to.x + (toMeta?.width || 1) * GRID_SIZE / 2;
                const toY = to.y + (toMeta?.height || 1) * GRID_SIZE / 2;

                topologyLayer.moveTo(fromX, fromY).lineTo(toX, toY);
            }

            for (const pf of placedFacilities) {
                const meta = appData.facilities.find((f: any) => f.id === pf.facilityId);
                if (!meta) continue;

                const facilityContainer = new PIXI.Container();
                facilityContainer.x = pf.x;
                facilityContainer.y = pf.y;

                const gfx = new PIXI.Graphics();
                const color = meta.color ? parseInt(meta.color.replace('#', '0x')) : 0x555555;
                const rot = (pf.rotation || 0) % 360;
                const isRotated = rot === 90 || rot === 270;
                const width = (isRotated ? meta.height : meta.width) * GRID_SIZE;
                const height = (isRotated ? meta.width : meta.height) * GRID_SIZE;

                gfx.beginFill(color);
                gfx.drawRect(0, 0, width, height);
                gfx.endFill();

                if (pf.instanceId === selectedFacilityId) {
                    gfx.lineStyle(2, 0xffffff, 1);
                    gfx.drawRect(0, 0, width, height);
                }

                facilityContainer.addChild(gfx);

                if (meta.ports) {
                    for (const port of meta.ports) {
                        const pPos = getRotatedPortPosition(port, meta.width, meta.height, pf.rotation || 0);
                        const px = pPos.x * GRID_SIZE + GRID_SIZE / 2;
                        const py = pPos.y * GRID_SIZE + GRID_SIZE / 2;

                        const pGfx = new PIXI.Graphics();
                        const pColor = port.type === 'input' ? 0x00ff00 : 0xff0000;
                        pGfx.beginFill(pColor);
                        pGfx.drawCircle(0, 0, 4);
                        pGfx.endFill();
                        pGfx.x = px;
                        pGfx.y = py;
                        facilityContainer.addChild(pGfx);
                    }
                }
                facilitiesLayer.addChild(facilityContainer);
            }
        };
        renderScene();
    }, [placedFacilities, edges, selectedFacilityId, appData, config, GRID_SIZE]);

    // MAIN INITIALIZATION
    useEffect(() => {
        if (!containerRef.current || !config) return;

        let cleanupEvents: () => void = () => { };

        const init = async () => {
            const app = new PIXI.Application();
            await app.init({
                resizeTo: containerRef.current!,
                backgroundColor: config.theme?.workspace_bg ? parseInt(config.theme.workspace_bg.replace('#', '0x')) : 0x1e1e1e,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
            });

            containerRef.current!.appendChild(app.canvas);
            appRef.current = app;

            const world = new PIXI.Container();
            world.label = "world";
            app.stage.addChild(world);
            worldRef.current = world;

            // --- World Geometry ---
            const tilesX = config.world_size_tiles_x || 32;
            const tilesY = config.world_size_tiles_y || 20;
            const mapWidth = tilesX * GRID_SIZE;
            const mapHeight = tilesY * GRID_SIZE;

            // 1. Shadow
            const shadow = new PIXI.Graphics();
            shadow.beginFill(0x000000, 0.4);
            shadow.drawRect(4, 4, mapWidth, mapHeight);
            shadow.endFill();
            world.addChild(shadow);

            // 2. Artboard
            const artboard = new PIXI.Graphics();
            const artboardColor = config.theme?.artboard_bg ? parseInt(config.theme.artboard_bg.replace('#', '0x')) : 0xcccccc;
            artboard.beginFill(artboardColor);
            artboard.drawRect(0, 0, mapWidth, mapHeight);
            artboard.endFill();
            world.addChild(artboard);

            // 3. Grid
            const grid = new PIXI.Graphics();
            grid.setStrokeStyle({ width: 1, color: 0x000000, alpha: 0.1 });
            for (let x = 0; x <= mapWidth; x += GRID_SIZE) grid.moveTo(x, 0).lineTo(x, mapHeight);
            for (let y = 0; y <= mapHeight; y += GRID_SIZE) grid.moveTo(0, y).lineTo(mapWidth, y);
            grid.stroke();
            world.addChild(grid);


            world.setChildIndex(shadow, 0);
            world.setChildIndex(artboard, 1);
            world.setChildIndex(grid, 2);

            // --- CAMERA SETUP ---

            // Initial Centering Calculation
            const mapCenterX = mapWidth / 2;
            const mapCenterY = mapHeight / 2;

            // "Fit Screen" Zoom
            const padding = 100;
            const fitZoom = Math.min(
                (app.screen.width - padding) / mapWidth,
                (app.screen.height - padding) / mapHeight
            );
            const initialZoom = Math.min(Math.max(fitZoom, 0.5), 2.0);

            // Set Initial State
            // Pivot is ALWAYS the point on the map that is at Screen Center.
            // Initially, we want Map Center at Screen Center.
            let targetPivot = { x: mapCenterX, y: mapCenterY };
            let currentPivot = { x: mapCenterX, y: mapCenterY };

            let targetZoom = initialZoom;
            let currentZoom = initialZoom;

            let targetRotation = 0;
            let currentRotation = 0;

            // Apply Immediately
            world.pivot.set(currentPivot.x, currentPivot.y);
            world.position.set(app.screen.width / 2, app.screen.height / 2);
            world.scale.set(currentZoom);
            world.rotation = currentRotation;

            // --- INTERACTION STATE ---

            const keysPressed: Record<string, boolean> = {};
            let isDragging = false;
            let spacePressed = false;
            const PAN_SPEED = 15;

            // --- TICKER ---

            app.ticker.add(() => {
                const cx = app.screen.width / 2 - 123.5;
                const cy = app.screen.height / 2 - 76;

                // Ensure World Position is Screen Center
                world.position.set(cx, cy);

                // 1. WASD Panning
                if (!spacePressed && !keysPressed["AltLeft"] && !keysPressed["AltRight"]) {
                    let dx = 0;
                    let dy = 0;
                    if (keysPressed["KeyW"]) dy -= PAN_SPEED;
                    if (keysPressed["KeyS"]) dy += PAN_SPEED;
                    if (keysPressed["KeyA"]) dx -= PAN_SPEED;
                    if (keysPressed["KeyD"]) dx += PAN_SPEED;

                    if (dx !== 0 || dy !== 0) {
                        // Transform Screen Delta -> Map Delta
                        // Rotate input vector by -TargetRotation
                        const cos = Math.cos(-targetRotation);
                        const sin = Math.sin(-targetRotation);
                        const s = targetZoom;

                        const rdx = (dx * cos - dy * sin) / s;
                        const rdy = (dx * sin + dy * cos) / s;

                        targetPivot.x += rdx;
                        targetPivot.y += rdy;
                    }
                }

                // 2. Lerp
                const lerpPos = 0.3;
                if (Math.abs(targetPivot.x - currentPivot.x) > 0.1 || Math.abs(targetPivot.y - currentPivot.y) > 0.1) {
                    currentPivot.x += (targetPivot.x - currentPivot.x) * lerpPos;
                    currentPivot.y += (targetPivot.y - currentPivot.y) * lerpPos;
                } else {
                    currentPivot.x = targetPivot.x;
                    currentPivot.y = targetPivot.y;
                }

                if (Math.abs(targetZoom - currentZoom) > 0.001) {
                    currentZoom += (targetZoom - currentZoom) * 0.2;
                } else {
                    currentZoom = targetZoom;
                }

                if (Math.abs(targetRotation - currentRotation) > 0.001) {
                    currentRotation += (targetRotation - currentRotation) * 0.08;
                } else {
                    currentRotation = targetRotation;
                }

                // 3. Apply
                world.pivot.set(currentPivot.x, currentPivot.y);
                world.scale.set(currentZoom);
                world.rotation = currentRotation;

                // Expose debug info
                // if (window.viewportState) {
                //     window.viewportState = { pivot: currentPivot, rot: currentRotation, zoom: currentZoom };
                // }
            });

            // --- EVENTS ---

            const onKeyDown = (e: KeyboardEvent) => {
                if ((e.target as HTMLElement).tagName === "INPUT") return;
                keysPressed[e.code] = true;
                if (e.code === "Space" && !e.repeat) {
                    spacePressed = true;
                    isDragging = true; // Drag immediately on Key Down
                    app.canvas.style.cursor = "grabbing";
                }

                if (e.code === "KeyH") {
                    targetPivot.x = mapCenterX;
                    targetPivot.y = mapCenterY;
                    targetZoom = initialZoom;
                    targetRotation = 0;
                }

                if (e.altKey) {
                    if (e.code === "KeyA") {
                        targetRotation -= Math.PI / 2;
                        window.dispatchEvent(new CustomEvent('viewport-update', { detail: { rotation: targetRotation } }));
                    } else if (e.code === "KeyD") {
                        targetRotation += Math.PI / 2;
                        window.dispatchEvent(new CustomEvent('viewport-update', { detail: { rotation: targetRotation } }));
                    }
                }
            };

            const onKeyUp = (e: KeyboardEvent) => {
                keysPressed[e.code] = false;
                if (e.code === "Space") {
                    spacePressed = false;
                    isDragging = false; // Stop dragging on Key Up
                    app.canvas.style.cursor = "default";
                }
            };
            window.addEventListener("keydown", onKeyDown);
            window.addEventListener("keyup", onKeyUp);

            const onWheel = (e: WheelEvent) => {
                e.preventDefault();
                if (e.ctrlKey) {
                    // Zoom
                    const zoomFactor = Math.exp(-e.deltaY * 0.001);
                    targetZoom = Math.min(Math.max(targetZoom * zoomFactor, 0.1), 5.0);
                } else {
                    // Pan
                    const dx = e.deltaX;
                    const dy = e.deltaY;
                    const cos = Math.cos(-targetRotation);
                    const sin = Math.sin(-targetRotation);
                    const s = targetZoom;
                    const rdx = (dx * cos - dy * sin) / s;
                    const rdy = (dx * sin + dy * cos) / s;
                    targetPivot.x += rdx;
                    targetPivot.y += rdy;
                }
            };
            app.canvas.addEventListener("wheel", onWheel, { passive: false });

            const onMouseDown = (e: MouseEvent) => {
                if (isValidPanClick(e)) {
                    isDragging = true;
                    app.canvas.style.cursor = "grabbing";
                }
            };
            const isValidPanClick = (e: MouseEvent) => e.button === 1 || spacePressed; // Middle or Space+Left

            app.canvas.addEventListener("mousedown", onMouseDown);

            const onMouseMove = (e: MouseEvent) => {
                if (isDragging) {
                    const dx = e.movementX;
                    const dy = e.movementY;

                    // Drag Pan: Invert Delta
                    const cos = Math.cos(-targetRotation);
                    const sin = Math.sin(-targetRotation);
                    const s = targetZoom;

                    const ndx = -dx;
                    const ndy = -dy;

                    const rdx = (ndx * cos - ndy * sin) / s;
                    const rdy = (ndx * sin + ndy * cos) / s;

                    targetPivot.x += rdx;
                    targetPivot.y += rdy;

                    // Snap current to target for crisp drag
                    currentPivot.x = targetPivot.x;
                    currentPivot.y = targetPivot.y;
                }
            };
            window.addEventListener("mousemove", onMouseMove);

            const onMouseUp = () => { isDragging = false; app.canvas.style.cursor = spacePressed ? "grabbing" : "default"; };
            window.addEventListener("mouseup", onMouseUp);

            cleanupEvents = () => {
                window.removeEventListener("keydown", onKeyDown);
                window.removeEventListener("keyup", onKeyUp);
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            };
        };

        if (!appRef.current) init();

        return () => {
            if (cleanupEvents) cleanupEvents();
            if (appRef.current) {
                appRef.current.destroy(true, { children: true, texture: true });
                appRef.current = null;
            }
        };
    }, [config]);

    if (!config) return <div className="w-full h-full flex items-center justify-center text-white/20 font-bold uppercase tracking-widest bg-[#1e1e1e]">Loading Canvas...</div>;

    return (
        <div ref={containerRef} className="w-full h-full relative outline-none select-none overflow-hidden bg-[#1e1e1e]">
            {/* Sticky Orientation Gizmo */}
            <div className="absolute top-[1em] right-[1em] z-10 pointer-events-none opacity-80">
                <div
                    className="w-[4em] h-[4em] relative transition-transform duration-75 ease-out"
                    style={{ transform: `rotate(${-compassRotation}rad)` }}
                >
                    {/* N/S/E/W Compass */}
                    <div className="absolute inset-0 border-2 border-white/20 rounded-full bg-black/20 backdrop-blur-sm" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[0.3em] text-[0.7em] font-bold text-red-500">N</div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[0.3em] text-[0.7em] font-bold text-white/50">S</div>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[0.3em] text-[0.7em] font-bold text-white/50">W</div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[0.3em] text-[0.7em] font-bold text-white/50">E</div>
                    {/* Axis Lines */}
                    <div className="absolute top-[0.5em] bottom-[0.5em] left-1/2 w-px bg-white/10 -translate-x-1/2" />
                    <div className="absolute left-[0.5em] right-[0.5em] top-1/2 h-px bg-white/10 -translate-y-1/2" />
                </div>
            </div>

            {/* Viewport Info Overlay */}
            <div className="absolute bottom-[1em] left-[1em] z-10 text-[0.75em] font-mono text-white/40 pointer-events-none">
                Hints: Space/Middle-Click to Pan | Alt+A/D to Rotate | WASD to Move
            </div>
        </div>
    );
}
