import { useRef, useEffect, useState } from "react";
import * as PIXI from "pixi.js";
import { useSandbox } from "../hooks/useSandbox";
import { debugLog } from "../utils/logger";

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

export function Viewport({ appData, draggedFacilityId }: { appData: any, draggedFacilityId: string | null }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const worldRef = useRef<PIXI.Container | null>(null);

    const draggedFacilityIdRef = useRef<string | null>(null);
    const mousePosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

    useEffect(() => { draggedFacilityIdRef.current = draggedFacilityId; }, [draggedFacilityId]);

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
        const handleUpdate = (e: any) => {
            debugLog("[ViewportInteraction] compass-update received", e.detail);
            setCompassRotation(e.detail.rotation);
        };
        window.addEventListener('viewport-update', handleUpdate);
        return () => window.removeEventListener('viewport-update', handleUpdate);
    }, []);

    // Scene Rendering (Facilities & Topology)
    useEffect(() => {
        if (!containerRef.current || !appRef.current || !worldRef.current || !config) return;
        debugLog("[ViewportInteraction] Render Scene Triggered");
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

    // --- COMPONENT STATE REF ---
    // Moving interaction state to refs to persist across re-renders without re-init
    const interactionState = useRef({
        targetPivot: { x: 0, y: 0 },
        currentPivot: { x: 0, y: 0 },
        targetZoom: 1,
        currentZoom: 1,
        targetRotation: 0,
        currentRotation: 0,
        isDragging: false,
        spacePressed: false,
        keysPressed: {} as Record<string, boolean>,
        // Initialize flag to prevent resetting view on every render
        initialized: false
    });

    // --- PIXI SETUP ---
    useEffect(() => {
        if (!containerRef.current || !config || !interactionState.current) return;
        const GRID_SIZE = config.grid_size || 64;

        // Cleanup previous app if exists
        if (appRef.current) {
            appRef.current.destroy(true, { children: true, texture: true });
            appRef.current = null;
        }

        const app = new PIXI.Application();
        const initPixi = async () => {
            debugLog("[ViewportInteraction] Initializing PIXI Application");
            await app.init({
                resizeTo: containerRef.current!,
                backgroundColor: config.theme?.workspace_bg ? parseInt(config.theme.workspace_bg.replace('#', '0x')) : 0x1e1e1e,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
            });

            if (!containerRef.current) return; // safety check after await
            containerRef.current.appendChild(app.canvas);
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

            const previewLayer = new PIXI.Container();
            previewLayer.label = "preview";
            world.addChild(previewLayer);
            world.setChildIndex(previewLayer, 3);

            // --- CAMERA INIT ---
            const state = interactionState.current;
            if (!state.initialized) {
                const mapCenterX = mapWidth / 2;
                const mapCenterY = mapHeight / 2;
                const padding = 100;
                const fitZoom = Math.min(
                    (app.screen.width - padding) / mapWidth,
                    (app.screen.height - padding) / mapHeight
                );
                const initialZoom = Math.min(Math.max(fitZoom, 0.5), 2.0);

                state.targetPivot = { x: mapCenterX, y: mapCenterY };
                state.currentPivot = { x: mapCenterX, y: mapCenterY };
                state.targetZoom = initialZoom;
                state.currentZoom = initialZoom;
                state.initialized = true;
            }

            // Apply specific initial transform
            world.pivot.set(state.currentPivot.x, state.currentPivot.y);
            world.position.set(app.screen.width / 2, app.screen.height / 2);
            world.scale.set(state.currentZoom);
            world.rotation = state.currentRotation;


            // --- TICKER ---
            const PAN_SPEED = 15;
            app.ticker.add(() => {
                const state = interactionState.current;

                // Keep world center-screen
                const cx = app.screen.width / 2;
                const cy = app.screen.height / 2;
                world.position.set(cx, cy);

                // 1. WASD Panning
                if (!state.spacePressed && !state.keysPressed["AltLeft"] && !state.keysPressed["AltRight"]) {
                    let dx = 0;
                    let dy = 0;
                    if (state.keysPressed["KeyW"]) dy -= PAN_SPEED;
                    if (state.keysPressed["KeyS"]) dy += PAN_SPEED;
                    if (state.keysPressed["KeyA"]) dx -= PAN_SPEED;
                    if (state.keysPressed["KeyD"]) dx += PAN_SPEED;

                    if (dx !== 0 || dy !== 0) {
                        const cos = Math.cos(-state.targetRotation);
                        const sin = Math.sin(-state.targetRotation);
                        const s = state.targetZoom;
                        const rdx = (dx * cos - dy * sin) / s;
                        const rdy = (dx * sin + dy * cos) / s;
                        state.targetPivot.x += rdx;
                        state.targetPivot.y += rdy;
                    }
                }

                // 2. Lerp
                const lerpPos = 0.3;
                if (Math.abs(state.targetPivot.x - state.currentPivot.x) > 0.1 || Math.abs(state.targetPivot.y - state.currentPivot.y) > 0.1) {
                    state.currentPivot.x += (state.targetPivot.x - state.currentPivot.x) * lerpPos;
                    state.currentPivot.y += (state.targetPivot.y - state.currentPivot.y) * lerpPos;
                } else {
                    state.currentPivot.x = state.targetPivot.x;
                    state.currentPivot.y = state.targetPivot.y;
                }

                if (Math.abs(state.targetZoom - state.currentZoom) > 0.001) {
                    state.currentZoom += (state.targetZoom - state.currentZoom) * 0.2;
                } else {
                    state.currentZoom = state.targetZoom;
                }

                if (Math.abs(state.targetRotation - state.currentRotation) > 0.001) {
                    state.currentRotation += (state.targetRotation - state.currentRotation) * 0.08;
                } else {
                    state.currentRotation = state.targetRotation;
                }

                // 3. Apply
                world.pivot.set(state.currentPivot.x, state.currentPivot.y);
                world.scale.set(state.currentZoom);
                world.rotation = state.currentRotation;

                // --- PREVIEW RENDER ---
                previewLayer.removeChildren();
                const currentDraggedId = draggedFacilityIdRef.current;

                // Note: We need to access appData from prop/window safely if not in dependency
                // But we can check window.appData as fallback or use a ref for appData if needed.
                // Since appData is a prop, we should ideally use a ref for it if we use it in ticker.
                // However, the original code used window.appData or enclosure. 
                // Let's rely on window.appData for now as it's synced.
                if (currentDraggedId && window.appData?.facilities) {
                    const meta = window.appData.facilities.find((f: any) => f.id === currentDraggedId);
                    if (meta) {
                        const mPos = mousePosRef.current;
                        // Local to World
                        const worldPoint = world.toLocal({ x: mPos.x, y: mPos.y });
                        const snapX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
                        const snapY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;

                        const gfx = new PIXI.Graphics();
                        const width = (meta.width || 1) * GRID_SIZE;
                        const height = (meta.height || 1) * GRID_SIZE;

                        gfx.beginFill(0x0078d7, 0.3);
                        gfx.lineStyle(2, 0x0078d7, 0.8);
                        gfx.drawRect(0, 0, width, height);
                        gfx.endFill();

                        if (meta.ports) {
                            for (const port of meta.ports) {
                                const px = port.x * GRID_SIZE + GRID_SIZE / 2;
                                const py = port.y * GRID_SIZE + GRID_SIZE / 2;
                                gfx.beginFill(port.type === 'input' ? 0x00FF00 : 0xFF0000);
                                gfx.drawCircle(px, py, 6);
                                gfx.endFill();
                            }
                        }
                        gfx.x = snapX;
                        gfx.y = snapY;
                        previewLayer.addChild(gfx);

                        debugLog("[ViewportInteraction] Previewing placement at", snapX, snapY);
                    }
                }
            });
        };

        initPixi();

        return () => {
            if (appRef.current) {
                appRef.current.destroy(true, { children: true, texture: true });
                appRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(config)]); // Re-run only if config CONTENT changes

    // --- EVENTS SETUP ---
    useEffect(() => {
        // Event Handlers that use refs (stable)

        const onKeyDown = (e: KeyboardEvent) => {
            debugLog("[ViewportInteraction] KeyDown:", e.code);
            if ((e.target as HTMLElement).tagName === "INPUT") return;
            const state = interactionState.current;
            state.keysPressed[e.code] = true;

            if (e.code === "Space" && !e.repeat) {
                debugLog("[ViewportInteraction] Space Pressed - Pan Mode Active");
                state.spacePressed = true;
                state.isDragging = true;
                if (appRef.current?.canvas) appRef.current.canvas.style.cursor = "grabbing";
            }

            if (e.code === "KeyH") {
                // Reset Home (needs Map Dimensions... wait, we need map dimensions here.)
                // We'll reset to 0,0 or preserve the logic if we access config.
                // Since this effect has no deps, we can't easily access mapWidth/Height unless we calculate them again or store them in state.
                // For now, reset to 0,0 or current target.
                // Let's rely on config being available globally or via window since it's stable-ish.
                const tilesX = window.config?.world_size_tiles_x || 64;
                const tilesY = window.config?.world_size_tiles_y || 40;
                const GS = window.config?.grid_size || 64;
                state.targetPivot = { x: (tilesX * GS) / 2, y: (tilesY * GS) / 2 };
                state.targetZoom = 1.0;
                state.targetRotation = 0;
            }

            if (e.altKey) {
                if (e.code === "KeyA") {
                    debugLog("[ViewportInteraction] Alt+A - Rotate Left");
                    state.targetRotation -= Math.PI / 2;
                    window.dispatchEvent(new CustomEvent('viewport-update', { detail: { rotation: state.targetRotation } }));
                } else if (e.code === "KeyD") {
                    debugLog("[ViewportInteraction] Alt+D - Rotate Right");
                    state.targetRotation += Math.PI / 2;
                    window.dispatchEvent(new CustomEvent('viewport-update', { detail: { rotation: state.targetRotation } }));
                }
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            debugLog("[ViewportInteraction] KeyUp:", e.code);
            const state = interactionState.current;
            state.keysPressed[e.code] = false;
            if (e.code === "Space") {
                state.spacePressed = false;
                state.isDragging = false;
                if (appRef.current?.canvas) appRef.current.canvas.style.cursor = "default";
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            // 1. Update Mouse Pos Ref always
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                // debugLog("[ViewportInteraction] MouseMove:", mousePosRef.current); // Too noisy? 
            }

            const state = interactionState.current;
            if (state.isDragging) {
                const dx = e.movementX;
                const dy = e.movementY;
                const cos = Math.cos(-state.targetRotation);
                const sin = Math.sin(-state.targetRotation);
                const s = state.targetZoom;
                const ndx = -dx;
                const ndy = -dy;
                const rdx = (ndx * cos - ndy * sin) / s;
                const rdy = (ndx * sin + ndy * cos) / s;
                state.targetPivot.x += rdx;
                state.targetPivot.y += rdy;
                state.currentPivot.x = state.targetPivot.x;
                state.currentPivot.y = state.targetPivot.y;
                debugLog("[ViewportInteraction] Dragging Viewport delta:", dx, dy);
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            debugLog("[ViewportInteraction] MouseUp");
            const draggedId = draggedFacilityIdRef.current;
            const state = interactionState.current;

            // 1. Handle Placement
            if (draggedId && appRef.current && worldRef.current && containerRef.current) {
                debugLog("[Viewport] MouseUp Detected. DraggedId:", draggedId);
                const rect = containerRef.current.getBoundingClientRect();
                const clientX = e.clientX - rect.left;
                const clientY = e.clientY - rect.top;
                const GRID_SIZE = window.config?.grid_size || 64; // Use window config for access in handler

                if (clientX >= 0 && clientX <= rect.width && clientY >= 0 && clientY <= rect.height) {
                    const worldPoint = worldRef.current.toLocal({ x: clientX, y: clientY });
                    const snapX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
                    const snapY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;

                    debugLog("[ViewportInteraction] Dropping Facility:", draggedId, "at", snapX, snapY);
                    debugLog("[Viewport] Placing at:", snapX, snapY);
                    window.addFacility(draggedId, snapX, snapY);
                } else {
                    debugLog("[Viewport] Dropped outside bounds.");
                }
            } else {
                // debugLog("[Viewport] MouseUp ignored (No active drag or refs missing).");
            }

            // 2. Stop Dragging Viewport
            state.isDragging = false;
            if (appRef.current?.canvas) {
                appRef.current.canvas.style.cursor = state.spacePressed ? "grabbing" : "default";
            }
        };



        // Attach global listeners
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        // For Wheel, we need to bind to the canvas element specifically (passive: false)
        // But the canvas is created asynchronously in the OTHER effect.
        // Solution: Add a MutationObserver or poll? 
        // Simplest: Add wheel listener to containerRef which exists.
        const container = containerRef.current;
        const onContainerWheel = (e: WheelEvent) => {
            e.preventDefault();
            const state = interactionState.current;
            debugLog("[ViewportInteraction] Wheel Event", { ctrl: e.ctrlKey, deltaY: e.deltaY, deltaX: e.deltaX });
            if (e.ctrlKey) {
                const zoomFactor = Math.exp(-e.deltaY * 0.001);
                state.targetZoom = Math.min(Math.max(state.targetZoom * zoomFactor, 0.1), 5.0);
            } else {
                const dx = e.deltaX;
                const dy = e.deltaY;
                const cos = Math.cos(-state.targetRotation);
                const sin = Math.sin(-state.targetRotation);
                const s = state.targetZoom;
                const rdx = (dx * cos - dy * sin) / s;
                const rdy = (dx * sin + dy * cos) / s;
                state.targetPivot.x += rdx;
                state.targetPivot.y += rdy;
            }
        };

        // Also Pan-Start (MouseDown) needs to be on container/canvas
        const onContainerMouseDown = (e: MouseEvent) => {
            const state = interactionState.current;
            const isValidPanClick = e.button === 1 || state.spacePressed;
            debugLog("[ViewportInteraction] MouseDown", { button: e.button, spacePressed: state.spacePressed });
            if (isValidPanClick) {
                state.isDragging = true;
                if (appRef.current?.canvas) appRef.current.canvas.style.cursor = "grabbing";
            }
        };

        if (container) {
            container.addEventListener("wheel", onContainerWheel, { passive: false });
            container.addEventListener("mousedown", onContainerMouseDown);
        }

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            if (container) {
                container.removeEventListener("wheel", onContainerWheel);
                container.removeEventListener("mousedown", onContainerMouseDown);
            }
        };
    }, []); // Run ONCE. Refs are stable.

    if (!config) return <div className="w-full h-full flex items-center justify-center text-white/20 font-bold uppercase tracking-widest bg-[#1e1e1e]">Loading Canvas...</div>;

    return (
        <div
            ref={containerRef}
            className="w-full h-full relative outline-none select-none overflow-hidden bg-[#1e1e1e]"
        >
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
                Hints: Drag & Drop Facilities | Space/Middle-Click to Pan | Alt+A/D to Rotate | WASD to Move
            </div>
        </div>
    );
}
