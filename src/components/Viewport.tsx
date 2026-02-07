import { useRef, useEffect, useState } from "react";
// FORCE HMR
console.log("Viewport.tsx: HMR Refresh Triggered");
import * as PIXI from "pixi.js";
import { useSandbox } from "../hooks/useSandbox";
import { debugLog } from "../utils/logger";
import { Pathfinder } from "../utils/pathfinder";

declare global {
    interface Window {
        selectedFacilityId: string | null;
        addFacility: (id: string, x: number, y: number, rotation?: number) => void;
        updateFacility: (id: string, updates: any) => void;
        setMovingFacilityId: (id: string | null) => void;
        addEdge: (from: string, to: string) => void;
        isColliding: (x: number, y: number, w: number, h: number) => boolean;
        appData: any;
        placedFacilities: any[];
        config: any;
        viewportState?: any; // Debug access
        clearDragState: () => void;
        removeFacility: (id: string) => void;
    }
}

export function Viewport({ appData, draggedFacilityId, onDropFinished }: { appData: any, draggedFacilityId: string | null, onDropFinished?: () => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const worldRef = useRef<PIXI.Container | null>(null);

    const draggedFacilityIdRef = useRef<string | null>(null);
    const mousePosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

    const interactionState = useRef({
        isDragging: false,
        spacePressed: false,
        lastMousePos: { x: 0, y: 0 },
        targetZoom: 1.0,
        currentZoom: 1.0,
        targetPivot: { x: 0, y: 0 },
        currentPivot: { x: 0, y: 0 },
        targetRotation: 0,
        currentRotation: 0,
        keysPressed: {} as Record<string, boolean>,
        placementRotation: 0,
        draggedExistingId: null as string | null,
        dragStartOffset: { x: 0, y: 0 },
        isHolding: false,
        holdTimer: null as any,
        holdStartPos: { x: 0, y: 0 },
        initialized: false,
        pathStart: null as { x: number, y: number } | null,
        pathPreview: [] as { x: number, y: number }[]
    });

    useEffect(() => {
        debugLog("[ViewportInteraction] Mount");
        draggedFacilityIdRef.current = draggedFacilityId;
        return () => debugLog("[ViewportInteraction] Unmount");
    }, []);

    useEffect(() => {
        debugLog("[ViewportInteraction] draggedFacilityId updated to:", draggedFacilityId);
        draggedFacilityIdRef.current = draggedFacilityId;
    }, [draggedFacilityId]);

    const { placedFacilities, edges, occupancyMap, addFacility, updateFacility, removeFacility, setMovingFacilityId, addEdge, isColliding } = useSandbox(appData);
    const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
    const occupancyMapRef = useRef<Map<string, any>>(occupancyMap);
    const placedFacilitiesRef = useRef<any[]>(placedFacilities);

    useEffect(() => {
        occupancyMapRef.current = occupancyMap;
        placedFacilitiesRef.current = placedFacilities;
    }, [occupancyMap, placedFacilities]);

    // Pathfinding States
    const [pathStart, setPathStart] = useState<{ x: number, y: number } | null>(null);
    const [pathPreview, setPathPreview] = useState<{ x: number, y: number }[]>([]);
    const pathfinderRef = useRef<Pathfinder | null>(null);

    // Sync Pathfinder with Occupancy Map
    useEffect(() => {
        pathfinderRef.current = new Pathfinder(occupancyMap);
    }, [occupancyMap]);

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
        window.removeFacility = removeFacility;
        window.setMovingFacilityId = setMovingFacilityId;
        window.addEdge = addEdge;
        window.isColliding = isColliding;
        window.appData = appData;
        window.placedFacilities = placedFacilities;
        window.config = config;
    }, [selectedFacilityId, addFacility, updateFacility, removeFacility, setMovingFacilityId, addEdge, isColliding, appData, placedFacilities, config]);

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

        let pathPreviewLayer = world.children.find(c => c.label === "path-preview") as PIXI.Container;
        if (!pathPreviewLayer) {
            pathPreviewLayer = new PIXI.Container();
            pathPreviewLayer.label = "path-preview";
            world.addChildAt(pathPreviewLayer, world.children.indexOf(facilitiesLayer)); // Under facilities
        }
        pathPreviewLayer.removeChildren();

        let topologyLayer = world.children.find(c => c.label === "topology") as PIXI.Graphics;
        if (!topologyLayer) {
            topologyLayer = new PIXI.Graphics();
            topologyLayer.label = "topology";
            world.addChildAt(topologyLayer, 0); // Below facilities
        }

        facilitiesLayer.removeChildren();
        topologyLayer.clear();
        pathPreviewLayer.removeChildren();

        // DRAW PATH PREVIEW
        if (pathPreview.length > 0) {
            const beltMeta = window.appData?.facilities?.find((f: any) => f.id === window.config?.belt_id);
            const color = beltMeta?.color ? parseInt(beltMeta.color.replace('#', '0x')) : 0x0078d7;

            pathPreview.forEach((pos) => {
                const gfx = new PIXI.Graphics();
                gfx.beginFill(color, 0.3); // Semi-transparent
                gfx.drawRect(0, 0, GRID_SIZE, GRID_SIZE);
                gfx.endFill();

                // Border for nodes
                gfx.lineStyle(2, color, 0.5);
                gfx.drawRect(0, 0, GRID_SIZE, GRID_SIZE);

                gfx.x = pos.x * GRID_SIZE;
                gfx.y = pos.y * GRID_SIZE;
                pathPreviewLayer.addChild(gfx);
            });
        }

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

            // CLICK / TAP EVENT (< 1s Release)
            facilityContainer.on('pointertap', () => {
                // Only select if we did NOT just finish a drag
                // and if the hold timer was cleared before firing.
                // ALSO: Do not select if we are currently dragging/placing a NEW facility
                const state = interactionState.current;
                if (!state.draggedExistingId && !draggedFacilityIdRef.current) {
                    debugLog("[Viewport] Tap Detected (Selection):", pf.instanceId);
                    setSelectedFacilityId(pf.instanceId);
                    // Ensure visual feedback immediately
                    window.dispatchEvent(new CustomEvent('facility-selected', { detail: { id: pf.instanceId } }));
                } else if (draggedFacilityIdRef.current) {
                    debugLog("[Viewport] Tap Suppressed: Placement tool active (Ref check)");
                }
            });
            facilityContainer.on('pointerdown', (e) => {
                const state = interactionState.current;
                if (draggedFacilityIdRef.current) {
                    // If we are placing a NEW facility, do not start hold-to-drag timer for the existing one
                    return;
                }
                e.stopPropagation(); // Prevent panning/deselection

                // 1. Record Start Position for "Click vs Drag" threshold check (optional)
                // For now, simple time-based.

                // 2. Start Timer
                debugLog("[Viewport] PointerDown on Facility:", pf.instanceId, "- Starting Hold Timer");

                if (state.holdTimer) clearTimeout(state.holdTimer);

                // Store event data needed for drag start
                const worldPos = worldRef.current?.toLocal(e.global) || { x: 0, y: 0 };
                const dragOffset = {
                    x: Math.floor((worldPos.x - pf.x) / GRID_SIZE),
                    y: Math.floor((worldPos.y - pf.y) / GRID_SIZE)
                };

                state.holdStartPos = { x: e.global.x, y: e.global.y };
                state.isHolding = true;

                // VISUAL: Feedback for holding
                if (appRef.current?.canvas) appRef.current.canvas.style.cursor = "progress"; // Or 'wait'
                facilityContainer.cursor = "progress";

                // 1 Second Delay
                state.holdTimer = setTimeout(() => {
                    debugLog("[Viewport] Hold Duration Met! DRAG MODE ACTIVATED for:", pf.instanceId);

                    // ACTIVATE DRAG
                    state.draggedExistingId = pf.instanceId;
                    state.dragStartOffset = dragOffset;
                    state.isHolding = false; // Reset hold flag as we are now dragging

                    // Tell App/Sandbox
                    if (window.setMovingFacilityId) window.setMovingFacilityId(pf.instanceId);

                    // Visual/Cursor feedback?
                    if (appRef.current?.canvas) appRef.current.canvas.style.cursor = "grabbing";
                    facilityContainer.cursor = "grabbing";

                    // Select it too, why not?
                    setSelectedFacilityId(pf.instanceId);
                }, 1000); // 1000ms delay
            });

            // Note: pointerup handled globally or we can add it here to be safe for this specific object
            // But global mouseup is better to catch releases outside.
            // We'll handle the "Click" logic in global OnMouseUp if we detect we were holding but didn't drag.

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
                const isUniversal = window.config?.universal_provider_facility_ids?.includes(meta.id);

                for (const port of meta.ports) {
                    const pPos = getRotatedPortPosition(port, meta.width, meta.height, pf.rotation || 0);
                    const px = pPos.x * GRID_SIZE;
                    const py = pPos.y * GRID_SIZE;

                    const pGfx = new PIXI.Graphics();
                    const pColor = port.type === 'input' ? 0x00ff00 : 0xff0000;

                    // Specific Logic for Universal Provider Output Ports
                    const isInteractableOutput = isUniversal && port.type === 'output';

                    // NEW: Draw Full Block for Port
                    const alpha = isInteractableOutput ? 0.6 : 0.3; // More visible if interactable
                    pGfx.beginFill(pColor, alpha);
                    pGfx.drawRect(0, 0, GRID_SIZE, GRID_SIZE);
                    pGfx.endFill();

                    // Add border/stroke for better definition
                    pGfx.lineStyle(2, pColor, 0.8);
                    pGfx.drawRect(0, 0, GRID_SIZE, GRID_SIZE);

                    if (isInteractableOutput) {
                        pGfx.eventMode = 'static';
                        pGfx.cursor = 'pointer';

                        // Icon or Interaction Indicator in Center
                        pGfx.lineStyle(2, 0xffffff, 0.9);
                        pGfx.drawCircle(GRID_SIZE / 2, GRID_SIZE / 2, 6);

                        // Show selected item icon if exists
                        const setting = pf.port_settings?.find((s: any) => s.port_id === port.id);
                        if (setting) {
                            const item = window.appData?.items?.find((i: any) => i.id === setting.item_id);
                            if (item?.icon) {
                                // Draw simple dot representation for now, or sprite later
                                pGfx.beginFill(0xffffff, 1);
                                pGfx.drawCircle(GRID_SIZE / 2, GRID_SIZE / 2, 4);
                                pGfx.endFill();
                            }
                        }

                        pGfx.on('pointertap', (e) => {
                            // Prevent selection if we are placing something (e.g. Belt)
                            if (draggedFacilityIdRef.current) {
                                debugLog("[Viewport] Port Selection Blocked: Tool Active");
                                return;
                            }

                            e.stopPropagation();
                            debugLog("[Viewport] Port Selection Triggered:", pf.instanceId, port.id);
                            window.dispatchEvent(new CustomEvent('open-port-selector', {
                                detail: {
                                    instanceId: pf.instanceId,
                                    portId: port.id,
                                    facilityName: meta.name
                                }
                            }));
                        });
                    }

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
    }, [placedFacilities, edges, selectedFacilityId, config, GRID_SIZE, draggedFacilityId, pathPreview, pathStart]);


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
                // But we can check window.appData as fallback or use a ref for it if needed.
                // Since appData is a prop, we should ideally use a ref for it if we use it in ticker.
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
                        const colliding = window.isColliding(snapX, snapY, width, height);

                        // NEW: Show Ghosted Facility instead of solid color
                        const baseColor = 0x555555; // Standard grey for facility
                        const alpha = 0.4;
                        const strokeColor = colliding ? 0xff0000 : 0xffffff;

                        gfx.beginFill(baseColor, alpha);
                        gfx.lineStyle(2, strokeColor, 0.6);
                        gfx.drawRect(0, 0, width, height);
                        gfx.endFill();

                        // Draw Ports for Orientation Awareness
                        if (meta.ports) {
                            for (const port of meta.ports) {
                                const pPos = getRotatedPortPosition(port, meta.width || 1, meta.height || 1, rotation);
                                const px = pPos.x * GRID_SIZE + GRID_SIZE / 2;
                                const py = pPos.y * GRID_SIZE + GRID_SIZE / 2;

                                const pColor = port.type === 'input' ? 0x00ff00 : 0xff0000;
                                gfx.beginFill(pColor, alpha + 0.2);
                                gfx.drawCircle(px, py, 4);
                                gfx.endFill();
                            }
                        }

                        gfx.x = snapX;
                        gfx.y = snapY;
                        previewLayer.addChild(gfx);

                        // --- NEW: Pathfinding Preview in Ticker ---
                        if (state.pathStart && meta.id === window.config?.belt_id) {
                            if (pathfinderRef.current) {
                                const mPos = mousePosRef.current;
                                const worldPoint = world.toLocal({ x: mPos.x, y: mPos.y });
                                const gx = Math.floor(worldPoint.x / GRID_SIZE);
                                const gy = Math.floor(worldPoint.y / GRID_SIZE);

                                const newPath = pathfinderRef.current.findPath(state.pathStart, { x: gx, y: gy });
                                state.pathPreview = newPath.length > 0 ? newPath : [{ x: gx, y: gy }];

                                // Draw Path
                                const beltColor = meta.color ? parseInt(meta.color.replace('#', '0x')) : 0x0078d7;
                                state.pathPreview.forEach((pos) => {
                                    const pgfx = new PIXI.Graphics();
                                    pgfx.beginFill(beltColor, 0.3);
                                    pgfx.drawRect(0, 0, GRID_SIZE, GRID_SIZE);
                                    pgfx.endFill();
                                    pgfx.lineStyle(2, beltColor, 0.5);
                                    pgfx.drawRect(0, 0, GRID_SIZE, GRID_SIZE);
                                    pgfx.x = pos.x * GRID_SIZE;
                                    pgfx.y = pos.y * GRID_SIZE;
                                    previewLayer.addChild(pgfx);
                                });
                            }
                        }
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

                            // NEW: Use Ghosted look for moving existing as well
                            const baseColor = 0x555555;
                            const alpha = 0.4;

                            // Check collision (simple)
                            const isRotCurrent = (pf.rotation || 0) % 180 === 90;
                            const curW = (isRotCurrent ? meta.height : meta.width) * GRID_SIZE;
                            const curH = (isRotCurrent ? meta.width : meta.height) * GRID_SIZE;
                            const isColliding = window.isColliding(snapX, snapY, curW, curH);
                            const strokeColor = isColliding ? 0xff0000 : 0xffffff;

                            gfx.beginFill(baseColor, alpha);
                            gfx.lineStyle(2, strokeColor, 0.6);
                            gfx.drawRect(0, 0, width, height);
                            gfx.endFill();

                            // Ports
                            if (meta.ports) {
                                for (const port of meta.ports) {
                                    const pPos = getRotatedPortPosition(port, meta.width, meta.height, pf.rotation || 0);
                                    const px = pPos.x * GRID_SIZE + GRID_SIZE / 2;
                                    const py = pPos.y * GRID_SIZE + GRID_SIZE / 2;

                                    const pColor = port.type === 'input' ? 0x00ff00 : 0xff0000;
                                    gfx.beginFill(pColor, alpha + 0.2);
                                    gfx.drawCircle(px, py, 4);
                                    gfx.endFill();
                                }
                            }

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

            if (e.code === "Escape") {
                debugLog("[ViewportInteraction] Escape Pressed - Canceling Placement");
                setPathStart(null);
                setPathPreview([]);
                if (onDropFinished) onDropFinished();
                if (window.clearDragState) window.clearDragState();
                return;
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

                // NEW: Delete Facility
                if (e.code === "Delete" || e.code === "Backspace") {
                    if (window.selectedFacilityId) {
                        debugLog("[ViewportInteraction] Deleting Selected Facility:", window.selectedFacilityId);
                        removeFacility(window.selectedFacilityId);
                        setSelectedFacilityId(null);
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

            // CLEAR HOLD TIMER
            if (state.holdTimer) {
                clearTimeout(state.holdTimer);
                state.holdTimer = null;
            }

            // CHECK: Was this a CLICK on a facility?
            // If we were "holding" (pointerdown happened) but `draggedExistingId` is NULL,
            // it means the timer didn't fire. So it's a click.
            // We need to know WHICH facility was clicked. 
            // The hit testing is usually done by PIXI event. 
            // BUT, the PIXI 'pointerdown' above didn't receive the 'pointerup'.
            // Simple hack: We can check if we have a "pending" facility ID we stored in pointerdown?
            // Or simpler: We rely on the fact that if we aren't dragging, we might have clicked.
            // Wait, the PIXI 'click' or 'pointertap' event is better for clicks.
            // But we are suppressing events?

            // Let's refine: The `pointerdown` sets up the timer. 
            // If we release here, and `state.draggedExistingId` is null, but we *recently* pressed down...
            // Actually, we can't easily map the global mouseup to the specific facility unless we tracked "pendingId".
            // Let's rely on PIXI `pointerup` on the container? No, global is safer for drags.

            debugLog("[ViewportInteraction] MouseUp", { draggedId, isDragging: state.isDragging, draggedExistingId: state.draggedExistingId, isHolding: state.isHolding });

            if (state.isHolding) {
                // We were holding, but timer didn't fire (so < 1s).
                // We should trigger SELECTION logic here if we can identify the target.
                // However, we don't have the target ID here easily.
                // ALTERNATIVE: Use `pointertap` on the facility for selection! 
                // But `pointerdown` + `pointerup` = `pointertap`.
                // If we consume `pointerdown`, `pointertap` might still fire.
                // Let's try adding `pointertap` to the facility in `renderScene`.
                state.isHolding = false;
                // Reset cursor if we were holding but didn't drag
                if (appRef.current?.canvas) appRef.current.canvas.style.cursor = "default";
            }

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

                    if (draggedId === (window as any).config?.belt_id) {
                        const GX = Math.floor(worldPoint.x / GRID_SIZE);
                        const GY = Math.floor(worldPoint.y / GRID_SIZE);
                        const key = `${GX},${GY}`;
                        const occupant = occupancyMapRef.current.get(key);

                        if (!state.pathStart) {
                            // Correct Logic: Belt starts from Output port (lobang keluar) OR potentially empty ground if continuing existing line
                            if (!occupant || !occupant.port || occupant.port.type !== 'output') {
                                // Relaxed: Allow start from ground? Maybe not for now to keep logic clean.
                                // Actually, let's keep strict start (Output Port) for now.
                                debugLog(`[Pathfinding] Start blocked at [${GX},${GY}]. Must start at Output port. Occupant:`, occupant);
                                return;
                            }
                            debugLog("[Pathfinding] Set Start Point (Output):", GX, GY, "Port:", occupant.port.id);
                            state.pathStart = { x: GX, y: GY };
                            setPathStart({ x: GX, y: GY });
                            return;
                        } else {
                            // Finalize Path
                            // Strict Check: Must end at Input Port?
                            // User Feedback: Allow ending on empty ground to "continue later".

                            const isInputPort = occupant && occupant.port && occupant.port.type === 'input';
                            const isEmpty = !occupant;

                            // If not input port AND not empty, block (e.g. hitting a wall or machine body)
                            if (!isInputPort && !isEmpty) {
                                debugLog(`[Pathfinding] Finalize blocked at [${GX},${GY}]. Obstacle detected.`);
                                return;
                            }

                            // If empty, verify it's valid ground (not OOB) - implicit by getting here

                            debugLog("[Pathfinding] Finalizing Path at:", GX, GY, "Nodes:", state.pathPreview.length);

                            state.pathPreview.forEach((pos, i) => {
                                const next = state.pathPreview[i + 1];
                                const prev = state.pathPreview[i - 1];
                                // ... Logic for rotation ...

                                let rotation = 0;
                                const nodeToCompare = next || prev;
                                // If endpoint (no next), align with previous
                                if (nodeToCompare) {
                                    const dx = nodeToCompare.x - pos.x;
                                    const dy = nodeToCompare.y - pos.y;
                                    // If we are looking at next, vector is pos -> next.
                                    // If we are looking at prev (endpoint), vector is prev -> pos.

                                    // Standard logic: Align belt flow direction
                                    // Current belt piece should point to 'next'
                                    if (next) {
                                        const vx = next.x - pos.x;
                                        const vy = next.y - pos.y;
                                        if (vx > 0) rotation = 0;      // Right
                                        else if (vx < 0) rotation = 180; // Left
                                        else if (vy > 0) rotation = 90;  // Down
                                        else if (vy < 0) rotation = 270; // Up
                                    } else if (prev) {
                                        // Endpoint: Alignment follows arrival vector
                                        const vx = pos.x - prev.x;
                                        const vy = pos.y - prev.y;
                                        if (vx > 0) rotation = 0;
                                        else if (vx < 0) rotation = 180;
                                        else if (vy > 0) rotation = 90;
                                        else if (vy < 0) rotation = 270;
                                    }
                                }

                                const nodeKey = `${pos.x},${pos.y}`;
                                const existing = occupancyMapRef.current.get(nodeKey);
                                let isBridgeNeeded = false;

                                // Auto-Bridge Logic or Replacement
                                if (existing && existing.instanceId) {
                                    const existingPf = placedFacilitiesRef.current.find(f => f.instanceId === existing.instanceId);
                                    const isExistingBelt = existingPf && existingPf.facilityId === (window as any).config?.belt_id;

                                    if (isExistingBelt) {
                                        const existingRot = (existingPf.rotation || 0) % 180;
                                        const newRot = rotation % 180;
                                        // If perpendicular, maybe bridge? For now simple replacement
                                        if (existingRot !== newRot) {
                                            // Ideally check for bridge capability
                                            // For now, Replace checks.
                                        }
                                        window.removeFacility(existing.instanceId);
                                    }
                                }
                                const finalId = isBridgeNeeded ? "item_port_belt_bridge_1" : draggedId;
                                (window as any).addFacility(finalId, pos.x * GRID_SIZE, pos.y * GRID_SIZE, rotation);
                            });

                            state.pathStart = null;
                            state.pathPreview = [];
                            setPathStart(null);
                            setPathPreview([]);
                            if (onDropFinished) onDropFinished();
                            if (window.clearDragState) window.clearDragState();
                            return;
                        }
                    } else {
                        // Standard Facility Placement
                        let meta = window.appData?.facilities?.find((f: any) => f.id === draggedId);
                        if (meta) {
                            const isRotated = rot % 180 === 90;
                            const w = (isRotated ? meta.height : meta.width) * GRID_SIZE;
                            const h = (isRotated ? meta.width : meta.height) * GRID_SIZE;

                            if (!window.isColliding(snapX, snapY, w, h)) {
                                debugLog("[ViewportInteraction] Placing Facility:", draggedId, "at", snapX, snapY);
                                addFacility(draggedId, snapX, snapY, rot);
                                if (onDropFinished) onDropFinished();
                                if (window.clearDragState) window.clearDragState();
                            } else {
                                debugLog("[ViewportInteraction] Placement blocked (Collision)");
                            }
                        }
                    }
                }
            } else {
                debugLog("[Viewport] Dropped outside bounds.");
                if (onDropFinished) onDropFinished();
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
                        if (!window.isColliding(snapX, snapY, w, h)) {
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
                if (pathStart) {
                    debugLog("[Pathfinding] Cancelling Path Construction");
                    setPathStart(null);
                    setPathPreview([]);
                }
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
