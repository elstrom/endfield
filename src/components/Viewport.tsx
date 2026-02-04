import { useRef, useEffect, useState } from "react";
import { Application, Graphics, Container, Sprite, Assets, Point } from "pixi.js";
import { invoke } from "@tauri-apps/api/core";
import { useSandbox } from "@/hooks/useSandbox";

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
    const appRef = useRef<Application | null>(null);
    const worldRef = useRef<Container | null>(null);
    const [appData, setAppData] = useState<{ facilities: any[], items: any[], recipes: any[], config: any, geometry: any[] }>({
        facilities: [],
        items: [],
        recipes: [],
        config: null,
        geometry: []
    });
    const { placedFacilities, edges, addFacility, addEdge, isColliding, rotateFacility } = useSandbox();
    const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
    const [powerStatus, setPowerStatus] = useState<any>({ total_generation: 0, total_consumption: 0, power_balance: 0, powered_count: 0 });

    useEffect(() => {
        invoke("get_app_data")
            .then((data: any) => {
                console.log("App data loaded:", data);
                setAppData(data);
            })
            .catch(err => console.error("Failed to load app data:", err));
    }, []);

    // Poll power status
    useEffect(() => {
        const interval = setInterval(() => {
            invoke("get_power_status")
                .then((status: any) => setPowerStatus(status))
                .catch(err => console.error("Power status poll error:", err));
        }, 1000);
        return () => clearInterval(interval);
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

        let facilitiesLayer = world.children.find(c => c.label === "facilities") as Container;
        if (!facilitiesLayer) {
            facilitiesLayer = new Container();
            facilitiesLayer.label = "facilities";
            world.addChild(facilitiesLayer);
        }

        let topologyLayer = world.children.find(c => c.label === "topology") as Graphics;
        if (!topologyLayer) {
            topologyLayer = new Graphics();
            topologyLayer.label = "topology";
            world.addChildAt(topologyLayer, 0);
        }

        const renderScene = async () => {
            facilitiesLayer.removeChildren();
            topologyLayer.clear();

            // Draw Connections
            topologyLayer.lineStyle(2, parseInt(config.visuals.colors.topology_edge), config.visuals.opacity.topology);
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
                const geom = appData.geometry.find((g: any) => g.type === meta?.name);
                if (!meta) continue;

                const iconPath = `/images/facilities/${pf.facilityId}.png`;
                try {
                    const texture = await Assets.load(iconPath);
                    const sprite = new Sprite(texture);

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

                    const border = new Graphics();
                    border.setStrokeStyle({ width: 1, color: parseInt(config.visuals.colors.node_border), alpha: config.visuals.opacity.node_border });
                    border.rect(pf.x, pf.y, rotatedWidth * GRID_SIZE, rotatedHeight * GRID_SIZE);
                    border.stroke();

                    facilitiesLayer.addChild(sprite);
                    facilitiesLayer.addChild(border);

                    // Draw Ports
                    if (geom?.ports) {
                        for (const port of geom.ports) {
                            const rotatedPos = getRotatedPortPosition(port, meta.width, meta.height, pf.rotation);
                            const portX = pf.x + rotatedPos.x * GRID_SIZE + GRID_SIZE / 2;
                            const portY = pf.y + rotatedPos.y * GRID_SIZE + GRID_SIZE / 2;

                            const portCircle = new Graphics();
                            const portColor = port.type === 'input' ? 0x22c55e : 0xef4444;
                            portCircle.beginFill(portColor, 0.8);
                            portCircle.drawCircle(portX, portY, 4);
                            portCircle.endFill();
                            facilitiesLayer.addChild(portCircle);
                        }
                    }
                } catch (e) {
                    const rect = new Graphics();
                    rect.beginFill(0x222222);
                    rect.drawRect(pf.x, pf.y, meta.width * GRID_SIZE, meta.height * GRID_SIZE);
                    rect.endFill();
                    facilitiesLayer.addChild(rect);
                }
            }
        };

        renderScene();
    }, [placedFacilities, edges, appData, config]);

    // Application Setup
    useEffect(() => {
        if (!containerRef.current || !config) return;

        const init = async () => {
            const app = new Application();
            await app.init({
                resizeTo: containerRef.current!,
                backgroundColor: parseInt(config.visuals.colors.background),
                antialias: true,
                resolution: window.devicePixelRatio || 1,
            });

            containerRef.current!.appendChild(app.canvas);
            appRef.current = app;

            const world = new Container();
            world.label = "world";
            app.stage.addChild(world);
            worldRef.current = world;

            const grid = new Graphics();
            grid.setStrokeStyle({ width: 1, color: parseInt(config.visuals.colors.grid_line), alpha: config.visuals.opacity.grid });
            const boardSize = config.simulation.world_width;
            for (let x = 0; x <= boardSize; x += GRID_SIZE) grid.moveTo(x, 0).lineTo(x, boardSize);
            for (let y = 0; y <= boardSize; y += GRID_SIZE) grid.moveTo(0, y).lineTo(boardSize, y);
            grid.stroke();
            world.addChildAt(grid, 0);

            const overlayLayer = new Container();
            overlayLayer.label = "overlay";
            app.stage.addChild(overlayLayer);

            let isDragging = false;
            let isConnecting = false;
            let lastPos = { x: 0, y: 0 };
            let connectionStartId: string | null = null;

            app.canvas.addEventListener("mousedown", (e) => {
                const localPos = world.toLocal(new Point(e.clientX, e.clientY));
                const target = window.placedFacilities.find(pf => {
                    const meta = window.appData?.facilities.find((f: any) => f.id === pf.facilityId);
                    if (!meta) return false;
                    return localPos.x >= pf.x && localPos.x <= pf.x + meta.width * GRID_SIZE &&
                        localPos.y >= pf.y && localPos.y <= pf.y + meta.height * GRID_SIZE;
                });

                if (e.button === 2 && target) {
                    // Right-click to rotate
                    e.preventDefault();
                    rotateFacility(target.instanceId);
                } else if (e.shiftKey && target) {
                    isConnecting = true;
                    connectionStartId = target.instanceId;
                } else if (e.button === 1 || (e.button === 0 && e.altKey)) {
                    isDragging = true;
                    lastPos = { x: e.clientX, y: e.clientY };
                } else if (e.button === 0 && !e.shiftKey) {
                    const snapX = Math.floor(localPos.x / GRID_SIZE) * GRID_SIZE;
                    const snapY = Math.floor(localPos.y / GRID_SIZE) * GRID_SIZE;

                    if (window.selectedFacilityId) {
                        const meta = window.appData?.facilities.find((f: any) => f.id === window.selectedFacilityId);
                        if (meta && !window.isColliding(snapX, snapY, meta.width, meta.height, window.appData.facilities)) {
                            window.addFacility(window.selectedFacilityId, snapX, snapY);
                        }
                    }
                }
            });

            // Disable context menu
            app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

            // Keyboard shortcuts
            window.addEventListener("keydown", (e) => {
                if (e.key === "r" || e.key === "R") {
                    const hoveredFacility = window.placedFacilities[window.placedFacilities.length - 1];
                    if (hoveredFacility) {
                        rotateFacility(hoveredFacility.instanceId);
                    }
                }
            });

            window.addEventListener("mousemove", (e) => {
                const localPos = world.toLocal(new Point(e.clientX, e.clientY));
                if (isDragging) {
                    world.x += e.clientX - lastPos.x;
                    world.y += e.clientY - lastPos.y;
                    lastPos = { x: e.clientX, y: e.clientY };
                }

                overlayLayer.removeChildren();
                if (isConnecting && connectionStartId) {
                    const start = window.placedFacilities.find(f => f.instanceId === connectionStartId);
                    if (start) {
                        const startStage = world.toGlobal(new Point(start.x + GRID_SIZE, start.y + GRID_SIZE));
                        const line = new Graphics();
                        line.lineStyle(3, parseInt(config.visuals.colors.brand), 0.6);
                        line.moveTo(startStage.x, startStage.y).lineTo(e.clientX, e.clientY);
                        overlayLayer.addChild(line);
                    }
                } else if (!isDragging && window.selectedFacilityId) {
                    const snapX = Math.floor(localPos.x / GRID_SIZE) * GRID_SIZE;
                    const snapY = Math.floor(localPos.y / GRID_SIZE) * GRID_SIZE;
                    const meta = window.appData?.facilities.find((f: any) => f.id === window.selectedFacilityId);
                    if (meta) {
                        const colliding = window.isColliding(snapX, snapY, meta.width, meta.height, window.appData.facilities);
                        const color = colliding ? parseInt(config.visuals.colors.ghost_colliding) : parseInt(config.visuals.colors.ghost_valid);
                        const ghost = new Graphics().beginFill(color, config.visuals.opacity.ghost).lineStyle(2, color, 0.5);
                        const stagePos = world.toGlobal(new Point(snapX, snapY));
                        ghost.drawRect(stagePos.x, stagePos.y, meta.width * GRID_SIZE * world.scale.x, meta.height * GRID_SIZE * world.scale.y).endFill();
                        overlayLayer.addChild(ghost);
                    }
                }
            });

            window.addEventListener("mouseup", (e) => {
                if (isConnecting && connectionStartId) {
                    const localPos = world.toLocal(new Point(e.clientX, e.clientY));
                    const target = window.placedFacilities.find(pf => {
                        const meta = window.appData?.facilities.find((f: any) => f.id === pf.facilityId);
                        if (!meta) return false;
                        return localPos.x >= pf.x && localPos.x <= pf.x + meta.width * GRID_SIZE &&
                            localPos.y >= pf.y && localPos.y <= pf.y + meta.height * GRID_SIZE;
                    });
                    if (target && target.instanceId !== connectionStartId) {
                        window.addEdge(connectionStartId, target.instanceId);
                    }
                }
                isDragging = false;
                isConnecting = false;
                connectionStartId = null;
            });

            app.canvas.addEventListener("wheel", (e) => {
                e.preventDefault();
                const zoom = Math.exp(-e.deltaY * 0.001);
                const mousePos = new Point(e.clientX, e.clientY);
                const localPos = world.toLocal(mousePos);
                const newScale = Math.min(Math.max(world.scale.x * zoom, config.simulation.min_zoom), config.simulation.max_zoom);
                world.scale.set(newScale);
                const newMouseStagePos = world.toGlobal(localPos);
                world.x -= (newMouseStagePos.x - mousePos.x);
                world.y -= (newMouseStagePos.y - mousePos.y);
            }, { passive: false });
        };

        init();
        return () => { if (appRef.current) appRef.current.destroy(true, { children: true, texture: true }); };
    }, [config]);

    useEffect(() => {
        window.selectedFacilityId = selectedFacilityId;
        window.addFacility = addFacility;
        window.addEdge = addEdge;
        window.isColliding = isColliding;
        window.appData = appData;
        window.placedFacilities = placedFacilities;
        window.config = config;
    }, [selectedFacilityId, addFacility, addEdge, isColliding, appData, placedFacilities, config]);

    if (!config) return <div className="w-full h-full bg-black flex items-center justify-center text-brand font-black animate-pulse">BOOTING NEURAL SOLVER...</div>;

    return (
        <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#050505]">
            <div className="absolute top-6 left-6 z-10 flex flex-col gap-6 pointer-events-none">
                <div className="p-6 bg-black/90 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 text-white shadow-2xl pointer-events-auto w-80">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-4 h-4 rounded-full bg-brand shadow-[0_0_20px_rgba(255,80,0,0.6)] animate-pulse" />
                        <h2 className="text-2xl font-black italic text-brand tracking-tighter uppercase">END-CORE</h2>
                    </div>
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-bold opacity-30 uppercase tracking-[0.4em] ml-2">Units Palette</h3>
                        <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-3 scrollbar-hide">
                            {appData.facilities.map((f) => (
                                <button key={f.id} onClick={() => setSelectedFacilityId(f.id)} className={`group flex items-center gap-4 p-4 rounded-3xl border transition-all pointer-events-auto w-full relative ${selectedFacilityId === f.id ? "bg-brand border-brand shadow-lg" : "bg-white/[0.03] border-white/5"}`}>
                                    <img src={`/images/facilities/${f.id}.png`} className={`w-14 h-14 object-contain rounded-2xl p-2 ${selectedFacilityId === f.id ? "bg-black/20" : "bg-black/40"}`} />
                                    <div>
                                        <div className={`text-md font-black tracking-tight ${selectedFacilityId === f.id ? "text-black" : "text-white/90"}`}>{f.name}</div>
                                        <div className={`text-[9px] font-bold mt-1 uppercase tracking-widest ${selectedFacilityId === f.id ? "text-black/50" : "opacity-30"}`}>{f.width}×{f.height}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute top-6 right-6 z-10 flex flex-col gap-4 pointer-events-none">
                <div className="p-6 bg-black/90 backdrop-blur-3xl rounded-[2rem] border border-white/5 text-white w-64 shadow-2xl pointer-events-auto">
                    <div className="text-[10px] opacity-20 mb-5 uppercase tracking-[0.4em] font-black italic">Network Matrix</div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-brand/30 transition-colors">
                            <span className="text-[10px] opacity-40 uppercase tracking-widest">Active Nodes</span>
                            <span className="text-lg font-black font-mono text-brand truncate max-w-[80px]">{placedFacilities.length}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-green-500/30 transition-colors">
                            <span className="text-[10px] opacity-40 uppercase tracking-widest">Edges</span>
                            <span className="text-lg font-black font-mono text-brand">{edges.length}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-yellow-500/30 transition-colors">
                            <span className="text-[10px] opacity-40 uppercase tracking-widest">Power Gen</span>
                            <span className="text-lg font-black font-mono text-green-400">{powerStatus.total_generation.toFixed(0)}W</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-red-500/30 transition-colors">
                            <span className="text-[10px] opacity-40 uppercase tracking-widest">Power Use</span>
                            <span className="text-lg font-black font-mono text-red-400">{powerStatus.total_consumption.toFixed(0)}W</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-colors">
                            <span className="text-[10px] opacity-40 uppercase tracking-widest">Balance</span>
                            <span className={`text-lg font-black font-mono ${powerStatus.power_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{powerStatus.power_balance >= 0 ? '+' : ''}{powerStatus.power_balance.toFixed(0)}W</span>
                        </div>
                    </div>
                    <button className="w-full mt-6 py-4 bg-brand rounded-2xl text-black font-black uppercase italic tracking-tighter hover:scale-[1.03] active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,80,0,0.2)]">
                        Optimize Topology
                    </button>
                </div>
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-4 pointer-events-none">
                <div className="px-8 py-4 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">
                    <span className="text-white/60">Shift + Drag</span> Connect Nodes
                </div>
            </div>

            <div className="absolute bottom-8 right-8 z-10 flex items-center gap-10 px-10 py-5 bg-black/80 backdrop-blur-3xl rounded-full border border-white/5 text-[10px] text-white/40 font-black uppercase tracking-[0.6em] pointer-events-none shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-brand animate-ping" />
                    <span className="text-brand">60 FPS</span>
                </div>
                <div className="w-px h-6 bg-white/5" />
                <span>Neural Solver :: Active</span>
            </div>
        </div>
    );
}
