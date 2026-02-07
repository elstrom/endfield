import { useRef, useEffect, useState } from "react";
// FORCE HMR
console.log("Viewport.tsx: HMR Refresh Triggered");
import * as PIXI from "pixi.js";
import { useSandbox } from "../hooks/useSandbox";
import { debugLog } from "../utils/logger";

declare global {
    interface Window {
        selectedFacilityId: string | null;
        addFacility: (id: string, x: number, y: number, rotation?: number) => void;
        updateFacility: (id: string, updates: any) => void;
        setMovingFacilityId: (id: string | null) => void;
        addEdge: (from: string, to: string) => void;
        isColliding: (x: number, y: number, w: number, h: number, data: any[]) => boolean;
        appData: any;
        placedFacilities: any[];
        config: any;
        viewportState?: any; // Debug access
        clearDragState: () => void;
    }
}

export function Viewport({ appData, draggedFacilityId, onDropFinished }: { appData: any, draggedFacilityId: string | null, onDropFinished?: () => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const worldRef = useRef<PIXI.Container | null>(null);

    const draggedFacilityIdRef = useRef<string | null>(null);
    const mousePosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

    useEffect(() => {
        debugLog("[ViewportInteraction] Mount");
        draggedFacilityIdRef.current = draggedFacilityId;
        return () => debugLog("[ViewportInteraction] Unmount");
    }, []);

    useEffect(() => {
        debugLog("[ViewportInteraction] draggedFacilityId updated to:", draggedFacilityId);
        draggedFacilityIdRef.current = draggedFacilityId;
    }, [draggedFacilityId]);

    const { placedFacilities, edges, addFacility, updateFacility, setMovingFacilityId, addEdge, isColliding } = useSandbox();
    const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);

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
        window.updateFacility = updateFacility;
        window.setMovingFacilityId = setMovingFacilityId;
        window.addEdge = addEdge;
        window.isColliding = isColliding;
        window.appData = appData;
        window.placedFacilities = placedFacilities;
        window.config = config;
    }, [selectedFacilityId, addFacility, updateFacility, setMovingFacilityId, addEdge, isColliding, appData, placedFacilities, config]);

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
    const renderScene = () => {
        if (!containerRef.current || !appRef.current || !worldRef.current || !config || !isReadyRef.current) {
            debugLog("[ViewportInteraction] renderScene skipped (not ready)");
            return;
        }

        const world = worldRef.current;
        debugLog("[ViewportInteraction] renderScene starting", { facilities: placedFacilities.length, edges: edges.length });

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

            // INTERACTION: Selectable
            facilityContainer.eventMode = 'static';
            facilityContainer.cursor = 'pointer';
            facilityContainer.on('pointerdown', (e) => {
                e.stopPropagation(); // Prevent panning/deselection
                debugLog("[Viewport] Selected Facility:", pf.instanceId);
                setSelectedFacilityId(pf.instanceId);

                // NEW: Tell sandbox we are moving this one (ignore in collision)
                if (window.setMovingFacilityId) window.setMovingFacilityId(pf.instanceId);

                // Start Dragging Existing
                const state = interactionState.current;
                state.draggedExistingId = pf.instanceId;

                // ARITHMETIC: Calculate Grid-Relative Offset
                if (worldRef.current) {
                    const worldPos = worldRef.current.toLocal(e.global);
                    state.dragStartOffset = {
                        x: Math.floor((worldPos.x - pf.x) / GRID_SIZE),
                        y: Math.floor((worldPos.y - pf.y) / GRID_SIZE)
                    };
                }
            });

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

            // Label
            const label = new PIXI.Text({
                text: meta.name || meta.id,
                style: {
                    fontFamily: 'Arial',
                    fontSize: 10,
                    fill: 0xffffff,
                    align: 'center',
                }
            });
            label.anchor.set(0.5);
            label.x = width / 2;
            label.y = height / 2;
            facilityContainer.addChild(label);

            facilitiesLayer.addChild(facilityContainer);
        }
        debugLog("[ViewportInteraction] Goal Print: renderScene completed");
    };

    useEffect(() => {
        renderScene();
    }, [placedFacilities, edges, selectedFacilityId, config, GRID_SIZE]);

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
        placementRotation: 0,
        draggedExistingId: null as string | null, // NEW: dragging existing facility
        dragStartOffset: { x: 0, y: 0 }, // NEW: offset for smooth dragging
        initialized: false
    });

    // --- PIXI SETUP ---
    const isReadyRef = useRef(false);

    useEffect(() => {
        if (!containerRef.current || !config) return;
        const GRID_SIZE = config.grid_size || 64;

        if (appRef.current) {
            // If app exists, we might just need to update background
            appRef.current.renderer.background.color = config.theme?.workspace_bg ? parseInt(config.theme.workspace_bg.replace('#', '0x')) : 0x1e1e1e;
            return;
        }

        const app = new PIXI.Application();
        const initPixi = async () => {
            debugLog("[ViewportInteraction] Initializing PIXI Application");
            await app.init({
                resizeTo: containerRef.current!,
                backgroundColor: config.theme?.workspace_bg ? parseInt(config.theme.workspace_bg.replace('#', '0x')) : 0x1e1e1e,
                antialias: true,
                resolution: 1,
            });

            if (!containerRef.current) return;
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

            world.pivot.set(state.currentPivot.x, state.currentPivot.y);
            world.position.set(app.screen.width / 2, app.screen.height / 2);
            world.scale.set(state.currentZoom);
            world.rotation = state.currentRotation;

            isReadyRef.current = true;
            renderScene(); // Explicit first render


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
                        const worldPoint = world.toLocal({ x: mPos.x, y: mPos.y });
                        const snapX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
                        const snapY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;

                        const rotation = interactionState.current.placementRotation || 0;
                        const isRotated = rotation % 180 === 90;
                        const width = (isRotated ? (meta.height || 1) : (meta.width || 1)) * GRID_SIZE;
                        const height = (isRotated ? (meta.width || 1) : (meta.height || 1)) * GRID_SIZE;

                        const gfx = new PIXI.Graphics();

                        // Check Collision
                        const colliding = window.isColliding(snapX, snapY, width, height, window.appData.facilities);

                        // RED if colliding, BLUE if safe
                        const color = colliding ? 0xff0000 : 0x0078d7;
                        const opacity = colliding ? 0.6 : 0.3;

                        gfx.beginFill(color, opacity);
                        gfx.lineStyle(2, color, 0.8);
                        gfx.drawRect(0, 0, width, height);
                        gfx.endFill();

                        gfx.x = snapX;
                        gfx.y = snapY;
                        previewLayer.addChild(gfx);

                        // debugLog("[ViewportInteraction] Previewing placement at", snapX, snapY, "Rot:", rotation);
                    }
                }

                // Mode 2: Moving Existing Facility
                if (state.draggedExistingId && window.placedFacilities) {
                    const pf = window.placedFacilities.find(f => f.instanceId === state.draggedExistingId);
                    if (pf && window.appData?.facilities) {
                        const meta = window.appData.facilities.find((f: any) => f.id === pf.facilityId);
                        if (meta) {
                            const mPos = mousePosRef.current;
                            const worldPoint = world.toLocal({ x: mPos.x, y: mPos.y });

                            // Adjust by drag start offset
                            const mouseGridX = Math.floor(worldPoint.x / GRID_SIZE);
                            const mouseGridY = Math.floor(worldPoint.y / GRID_SIZE);

                            const snapX = (mouseGridX - state.dragStartOffset.x) * GRID_SIZE;
                            const snapY = (mouseGridY - state.dragStartOffset.y) * GRID_SIZE;

                            const isRotated = (pf.rotation || 0) % 180 === 90;
                            const width = (isRotated ? meta.height : meta.width) * GRID_SIZE;
                            const height = (isRotated ? meta.width : meta.height) * GRID_SIZE;

                            const gfx = new PIXI.Graphics();
                            // TODO: isColliding doesn't ignore self yet. 
                            // But for MVP, colliding with self is "safe" if we assume logic handled elsewhere.
                            // Actually isColliding checks `placedFacilities`. 
                            // If we move slightly, we overlap with old self.
                            // Let's keep it simple: Show Green/Blue if moving.

                            const color = 0x00ff00;
                            gfx.beginFill(color, 0.5);
                            gfx.lineStyle(2, 0xffffff, 0.8);
                            gfx.drawRect(0, 0, width, height);
                            gfx.endFill();

                            gfx.x = snapX;
                            gfx.y = snapY;
                            previewLayer.addChild(gfx);
                        }
                    }
                }

                // Mode 3: Passive Hover Highlight (Follow Pointer)
                if (!state.draggedExistingId && !draggedFacilityIdRef.current) {
                    const mPos = mousePosRef.current;
                    const worldPoint = world.toLocal({ x: mPos.x, y: mPos.y });
                    const gx = Math.floor(worldPoint.x / GRID_SIZE);
                    const gy = Math.floor(worldPoint.y / GRID_SIZE);

                    const hx = gx * GRID_SIZE;
                    const hy = gy * GRID_SIZE;

                    const highlight = new PIXI.Graphics();
                    const accentColor = 0x0078d7; // Sky Blue Accent
                    highlight.beginFill(accentColor, 0.15); // Subtle fill
                    highlight.lineStyle(2, accentColor, 0.5); // Stronger borders
                    highlight.drawRect(0, 0, GRID_SIZE, GRID_SIZE);
                    highlight.endFill();
                    highlight.x = hx;
                    highlight.y = hy;
                    previewLayer.addChild(highlight);
                }
            }); // Properly close the ticker callback
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
                // Reset Home
                const tilesX = window.config?.world_size_tiles_x || 64;
                const tilesY = window.config?.world_size_tiles_y || 40;
                const GS = window.config?.grid_size || 64;
                state.targetPivot = { x: (tilesX * GS) / 2, y: (tilesY * GS) / 2 };
                state.targetZoom = 1.0;
                state.targetRotation = 0;
            }

            if (e.altKey) {
                // Camera Rotation
                if (e.code === "KeyA") {
                    debugLog("[ViewportInteraction] Alt+A - Rotate Left");
                    state.targetRotation -= Math.PI / 2;
                    window.dispatchEvent(new CustomEvent('viewport-update', { detail: { rotation: state.targetRotation } }));
                } else if (e.code === "KeyD") {
                    debugLog("[ViewportInteraction] Alt+D - Rotate Right");
                    state.targetRotation += Math.PI / 2;
                    window.dispatchEvent(new CustomEvent('viewport-update', { detail: { rotation: state.targetRotation } }));
                }
            } else {
                // Facility Rotation
                if (e.code === "KeyR") {
                    debugLog("[ViewportInteraction] KeyR Pressed", {
                        selected: window.selectedFacilityId,
                        draggedExisting: state.draggedExistingId,
                        draggedNew: draggedFacilityIdRef.current
                    });

                    // Priority 1: Rotate what is currently being dragged (Existing)
                    if (state.draggedExistingId) {
                        const pf = window.placedFacilities?.find(f => f.instanceId === state.draggedExistingId);
                        const meta = window.appData?.facilities?.find((m: any) => m.id === pf?.facilityId);
                        if (pf && meta) {
                            const newRot = (pf.rotation + 90) % 360;

                            // CRITICAL: Rotate the drag offset so the mouse stays on the same part of the building
                            const oldOffset = state.dragStartOffset;
                            // Rotate offset (x,y) -> (h-1-y, x)
                            state.dragStartOffset = {
                                x: (meta.height || 1) - 1 - oldOffset.y,
                                y: oldOffset.x
                            };

                            (window as any).updateFacility(pf.instanceId, { rotation: newRot });
                            debugLog("[ViewportInteraction] Rotated Dragging Facility:", pf.instanceId, "New Offset:", state.dragStartOffset);
                        }
                        return;
                    }

                    // Priority 2: Rotate Placement Preview
                    if (draggedFacilityIdRef.current) {
                        state.placementRotation = (state.placementRotation + 90) % 360;
                        debugLog("[ViewportInteraction] Rotated Placement Preview to:", state.placementRotation);
                        return;
                    }

                    // Priority 3: Rotate Selected Facility in-place
                    if (window.selectedFacilityId) {
                        const pf = window.placedFacilities?.find(f => f.instanceId === window.selectedFacilityId);
                        if (pf) {
                            const newRot = (pf.rotation + 90) % 360;
                            // Anchored Rotation: keep top-left (pf.x, pf.y) the same. 
                            // This is more predictable for grid-based building.
                            (window as any).updateFacility(pf.instanceId, { rotation: newRot });
                            debugLog("[ViewportInteraction] Rotated Selected Facility (Anchored):", pf.instanceId, "to", newRot);
                        }
                    }
                }
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            debugLog("[ViewportInteraction] KeyUp:", e.code);
            const state = interactionState.current;
            state.keysPressed[e.code] = false;
            // Clear space pressed even if key might be stuck logically
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

                // DISPATCH: Grid Coordinate for Footer
                if (worldRef.current) {
                    const worldPoint = worldRef.current.toLocal({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    const gx = Math.floor(worldPoint.x / GRID_SIZE);
                    const gy = Math.floor(worldPoint.y / GRID_SIZE);

                    // Direct Window Update for zero-latency display
                    if ((window as any).updateFooterCoord) {
                        (window as any).updateFooterCoord(gx, gy);
                    }

                    // Also dispatch event for others
                    window.dispatchEvent(new CustomEvent('mouse-grid-update', { detail: { x: gx, y: gy } }));
                }
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
                // debugLog("[ViewportInteraction] Dragging Viewport delta:", dx, dy);
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            const draggedId = draggedFacilityIdRef.current;
            const state = interactionState.current;
            debugLog("[ViewportInteraction] MouseUp", { draggedId, isDragging: state.isDragging, draggedExistingId: state.draggedExistingId });

            // 1. Handle Placement
            if (draggedId && appRef.current && worldRef.current && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const clientX = e.clientX - rect.left;
                const clientY = e.clientY - rect.top;
                const GRID_SIZE = window.config?.grid_size || 64;

                if (clientX >= 0 && clientX <= rect.width && clientY >= 0 && clientY <= rect.height) {
                    const worldPoint = worldRef.current.toLocal({ x: clientX, y: clientY });

                    // Use grid offset for drop too? 
                    // Actually placement from sidebar doesn't have offset, it centers mouse in box manually usually.
                    // But here we rely on snapX/Y from ticker.
                    const snapX = Math.floor(worldPoint.x / GRID_SIZE) * GRID_SIZE;
                    const snapY = Math.floor(worldPoint.y / GRID_SIZE) * GRID_SIZE;
                    const rot = state.placementRotation || 0;

                    let meta = window.appData?.facilities?.find((f: any) => f.id === draggedId);
                    if (meta) {
                        const isRotated = rot % 180 === 90;
                        const w = (isRotated ? meta.height : meta.width) * GRID_SIZE;
                        const h = (isRotated ? meta.width : meta.height) * GRID_SIZE;

                        if (window.isColliding(snapX, snapY, w, h, window.appData.facilities)) {
                            debugLog("[ViewportInteraction] Collision detected. Placement blocked.");
                            return; // Block placement
                        }

                        // Add with rotation
                        (window as any).addFacility(draggedId, snapX, snapY, rot);
                        debugLog("[ViewportInteraction] Dropping Facility:", draggedId, "at", snapX, snapY, "Rot:", rot);

                        // IMPORTANT: Notify App to clear state AFTER we used the data
                        if (onDropFinished) onDropFinished();
                        if (window.clearDragState) window.clearDragState();
                    }
                } else {
                    debugLog("[Viewport] Dropped outside bounds.");
                    if (onDropFinished) onDropFinished();
                    if (window.clearDragState) window.clearDragState();
                }
            }

            // 2. Handle Move Existing
            if (state.draggedExistingId && appRef.current && worldRef.current && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const clientX = e.clientX - rect.left;
                const clientY = e.clientY - rect.top;
                const GRID_SIZE = window.config?.grid_size || 64;

                const worldPoint = worldRef.current.toLocal({ x: clientX, y: clientY });
                const mouseGridX = Math.floor(worldPoint.x / GRID_SIZE);
                const mouseGridY = Math.floor(worldPoint.y / GRID_SIZE);
                const snapX = (mouseGridX - state.dragStartOffset.x) * GRID_SIZE;
                const snapY = (mouseGridY - state.dragStartOffset.y) * GRID_SIZE;

                const pf = window.placedFacilities?.find(f => f.instanceId === state.draggedExistingId);
                if (pf) {
                    const meta = window.appData?.facilities?.find((f: any) => f.id === pf.facilityId);
                    if (meta) {
                        const isRotated = (pf.rotation || 0) % 180 === 90;
                        const w = (isRotated ? meta.height : meta.width) * GRID_SIZE;
                        const h = (isRotated ? meta.width : meta.height) * GRID_SIZE;

                        // Simple collision check (ignoring self context for now)
                        // If colliding, don't update pos.
                        if (!window.isColliding(snapX, snapY, w, h, window.appData.facilities)) {
                            (window as any).updateFacility(state.draggedExistingId, { x: snapX, y: snapY });
                            debugLog("[ViewportInteraction] Moved Existing:", state.draggedExistingId, "to", snapX, snapY);
                        } else {
                            debugLog("[ViewportInteraction] Collision Blocked Move");
                        }
                    }
                }
                state.draggedExistingId = null;
                if (window.setMovingFacilityId) window.setMovingFacilityId(null);
            }

            // 3. Stop Dragging Viewport
            state.isDragging = false;
            if (appRef.current?.canvas) {
                appRef.current.canvas.style.cursor = state.spacePressed ? "grabbing" : "default";
            }
        };

        const onContainerWheel = (e: WheelEvent) => {
            e.preventDefault();
            debugLog("InputEvent: Wheel", {
                deltaY: e.deltaY,
                deltaMode: e.deltaMode,
                ctrl: e.ctrlKey,
                shift: e.shiftKey,
                meta: e.metaKey
            });

            const state = interactionState.current;

            // 1. Normalize Wheel Delta
            let delta = e.deltaY;
            if (e.deltaMode === 1) delta *= 32;      // Line
            else if (e.deltaMode === 2) delta *= 800; // Page

            // Helper: Apply Pan
            const applyPan = (dx: number, dy: number) => {
                const s = state.targetZoom;
                const cos = Math.cos(-state.targetRotation);
                const sin = Math.sin(-state.targetRotation);

                // Rotate screen delta to world delta
                const rdx = (dx * cos - dy * sin) / s;
                const rdy = (dx * sin + dy * cos) / s;

                debugLog(`Applying Pan: dx=${dx} dy=${dy} -> rdx=${rdx} rdy=${rdy}`);
                state.targetPivot.x += rdx;
                state.targetPivot.y += rdy;
            };

            if (e.ctrlKey) {
                // --- HORIZONTAL PAN (Ctrl + Scroll) ---
                // Scroll Up/Down moves Left/Right
                debugLog("Mode: Horizontal Pan (Ctrl)");
                applyPan(delta, 0);
            } else if (e.shiftKey) {
                // --- VERTICAL PAN (Shift + Scroll) ---
                debugLog("Mode: Vertical Pan (Shift)");
                applyPan(0, delta);
            } else {
                // --- ZOOM (Default Scroll) ---
                debugLog("Mode: Zoom (Default)");
                const zoomIntensity = 0.0015;
                const zoomFactor = Math.exp(-delta * zoomIntensity);
                const newZoom = Math.min(Math.max(state.targetZoom * zoomFactor, 0.1), 5.0);

                debugLog(`Zooming: Current=${state.targetZoom} New=${newZoom}`);

                if (containerRef.current && worldRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    const worldPoint = worldRef.current.toLocal({ x: mouseX, y: mouseY });

                    const sOld = state.targetZoom;
                    const sNew = newZoom;
                    const pOldX = state.targetPivot.x;
                    const pOldY = state.targetPivot.y;

                    const anchorX = worldPoint.x;
                    const anchorY = worldPoint.y;

                    state.targetPivot.x = anchorX - (anchorX - pOldX) * (sOld / sNew);
                    state.targetPivot.y = anchorY - (anchorY - pOldY) * (sOld / sNew);
                }
                state.targetZoom = newZoom;
            }
        };

        const onContainerMouseDown = (e: MouseEvent) => {
            const state = interactionState.current;
            const isValidPanClick = e.button === 1 || state.spacePressed;
            debugLog("[ViewportInteraction] MouseDown", { button: e.button, spacePressed: state.spacePressed });
            if (isValidPanClick) {
                state.isDragging = true;
                if (appRef.current?.canvas) appRef.current.canvas.style.cursor = "grabbing";
            }

            // Deselect if clicking on empty space (and not panning)
            if (!isValidPanClick && !state.draggedExistingId) {
                setSelectedFacilityId(null);
                if (window.setMovingFacilityId) window.setMovingFacilityId(null);
            }
        };

        // Attach global listeners
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        const container = containerRef.current;
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
    }, [config]); // Re-run when config loads/changes so containerRef is ready

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
