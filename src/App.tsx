import { useState, useEffect, useRef } from "react";
import { Viewport } from "./components/Viewport";
import {
  Menu, Box, Link2, MousePointer2, Move, Eraser,
  ChevronDown, ChevronRight, X, Info, Check, PlusCircle, Zap, Cpu,
  Maximize2, Filter, Activity, CircleDot, Trash2, Search
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { debugLog } from "./utils/logger";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Reusable Panel Section Component with Collapse Logic
const PanelSection = ({
  title,
  children,
  defaultOpen = true,
  headerActions,
  bgColor = "transparent"
}: {
  title: string,
  children: React.ReactNode,
  defaultOpen?: boolean,
  headerActions?: React.ReactNode,
  bgColor?: string
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="flex flex-col border-b last:border-b-0" style={{ borderColor: "#1c1c1c" }}>
      <div
        className="h-[2em] flex items-center px-[0.5em] gap-[0.5em] cursor-pointer select-none hover:bg-white/5 transition-colors bg-[#3c3c3c]"
        style={{ borderColor: "#1c1c1c" }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown size={12} className="opacity-70" /> : <ChevronRight size={12} className="opacity-70" />}
        <span className="font-bold text-[0.75em] uppercase tracking-wider opacity-90">{title}</span>
        {headerActions && (
          <div className="ml-auto flex items-center" onClick={(e) => e.stopPropagation()}>
            {headerActions}
          </div>
        )}
      </div>
      {isOpen && (
        <div style={{ backgroundColor: bgColor }} className="animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </section>
  );
};

// Reusable Preset Modal Component (Defined outside App to prevent re-frame/focus loss)
const PresetModal = ({
  isOpen,
  onClose,
  appData,
  onConfigChange,
  onSelectPreset
}: {
  isOpen: boolean,
  onClose: () => void,
  appData: any,
  onConfigChange: (updates: any) => void,
  onSelectPreset: (w: string, h: string) => void
}) => {
  const [newPreset, setNewPreset] = useState({ name: "New Layout", width: 64, height: 40 });

  // UseEffect to reset state when modal opens could be good, but simple state is fine.
  if (!isOpen) return null;

  const savePreset = () => {
    const presets = appData?.config?.presets || [];
    const updated = [...presets, { ...newPreset, id: Date.now().toString() }];
    onConfigChange({ presets: updated });
  };

  const deletePreset = (id: string) => {
    const updated = (appData?.config?.presets || []).filter((p: any) => p.id !== id);
    onConfigChange({ presets: updated });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-[2.5em] select-text"
      onClick={onClose}
    >
      <div className="bg-[#2b2b2b] w-full max-w-[64em] h-[45em] flex flex-col rounded-lg shadow-2xl border border-white/10 overflow-hidden text-white" onClick={e => e.stopPropagation()}>
        <div className="h-[2.8em] bg-[#3c3c3c] flex items-center px-[1em] justify-between border-b border-black/20 select-none">
          <span className="text-[0.85em] font-bold uppercase tracking-widest opacity-80">New Document / Canvas Presets</span>
          <button
            onClick={onClose}
            className="hover:bg-[#c42b1c] hover:text-white bg-white/5 p-[0.4em] rounded-sm transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[18em] bg-[#252525] border-r border-black/20 flex flex-col select-none">
            <div className="p-[0.8em] border-b border-white/5 text-[0.7em] font-bold opacity-40 uppercase">Saved Presets</div>
            <div className="flex-1 overflow-y-auto p-[0.6em] space-y-[0.3em]">
              {appData?.config?.presets?.map((p: any) => (
                <div key={p.id} className="group flex items-center gap-[0.5em] p-[0.6em] hover:bg-[#323232] rounded cursor-pointer transition-colors border border-transparent hover:border-white/5">
                  <div className="flex-1" onClick={() => { onSelectPreset(String(p.width), String(p.height)); onClose(); }}>
                    <div className="text-[0.85em] font-bold">{p.name}</div>
                    <div className="text-[0.7em] opacity-40">{p.width} x {p.height} Tiles</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deletePreset(p.id); }} className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-[0.3em]"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 bg-[#1e1e1e] flex flex-col items-center justify-center p-[3em] relative text-white select-none">
            <div className="absolute top-[1em] left-[1em] text-[0.7em] opacity-20 font-mono">PREVIEW RATIO</div>
            <div className="bg-[#cccccc] shadow-2xl border-[4px] border-white/20 relative" style={{ aspectRatio: `${newPreset.width} / ${newPreset.height}`, width: '80%', maxHeight: '80%' }}>
              <div className="absolute inset-0 flex items-center justify-center"><div className="text-black/20 font-bold text-2xl uppercase select-none opacity-50">Artboard</div></div>
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, black 1px, transparent 1px), linear-gradient(to bottom, black 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            </div>
            <div className="mt-[2em] text-[0.9em] font-mono opacity-50">{newPreset.width} x {newPreset.height} Tiles</div>
          </div>
          <div className="w-[20em] bg-[#2b2b2b] border-l border-black/20 p-[1.5em] space-y-[1.5em]">
            <div className="space-y-[1em]">
              <div className="flex flex-col gap-[0.5em]">
                <span className="text-[0.7em] font-bold opacity-40 uppercase select-none">Document Name</span>
                <input
                  type="text"
                  value={newPreset.name}
                  onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })}
                  className="bg-[#1e1e1e] border border-[#444] h-[2.5em] px-[0.8em] text-[0.9em] outline-none focus:border-[#0078d7] rounded-sm text-white w-full select-text"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-[1em]">
                <div className="flex flex-col gap-[0.5em]">
                  <span className="text-[0.7em] font-bold opacity-40 uppercase select-none">Width</span>
                  <input type="number" value={newPreset.width} onChange={(e) => setNewPreset({ ...newPreset, width: parseInt(e.target.value) || 0 })} className="bg-[#1e1e1e] border border-[#444] h-[2.5em] px-[0.8em] text-[0.9em] outline-none focus:border-[#0078d7] rounded-sm text-white select-text" />
                </div>
                <div className="flex flex-col gap-[0.5em]">
                  <span className="text-[0.7em] font-bold opacity-40 uppercase select-none">Height</span>
                  <input type="number" value={newPreset.height} onChange={(e) => setNewPreset({ ...newPreset, height: parseInt(e.target.value) || 0 })} className="bg-[#1e1e1e] border border-[#444] h-[2.5em] px-[0.8em] text-[0.9em] outline-none focus:border-[#0078d7] rounded-sm text-white select-text" />
                </div>
              </div>
            </div>
            <div className="pt-[1.5em] border-t border-white/5 space-y-[0.8em]">
              <button
                onClick={savePreset}
                className="w-full h-[2.8em] bg-[#3c3c3c] hover:bg-[#444] border border-white/10 text-white font-bold text-[0.85em] rounded transition-colors select-none"
              >
                SAVE AS PRESET
              </button>
              <button
                onClick={() => { onSelectPreset(String(newPreset.width), String(newPreset.height)); onClose(); }}
                className="w-full h-[3.2em] bg-[#0078d7] hover:bg-[#005a9e] text-white font-bold text-[0.95em] rounded shadow-lg transition-transform active:scale-95 select-none"
              >
                CREATE DOCUMENT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reusable Preferences Modal
const PreferencesModal = ({
  isOpen,
  onClose,
  config,
  onConfigChange
}: {
  isOpen: boolean,
  onClose: () => void,
  config: any,
  onConfigChange: (updates: any) => void
}) => {
  if (!isOpen) return null;

  const currentFontSize = config?.font_size_px || 12;

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    onConfigChange({ font_size_px: val });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        className="bg-[#2b2b2b] w-[24em] rounded-lg shadow-2xl border border-white/10 overflow-hidden text-white animate-in zoom-in-95 duration-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-[2.5em] bg-[#3c3c3c] flex items-center px-[0.8em] justify-between border-b border-black/20">
          <span className="text-[0.9em] font-bold uppercase tracking-widest opacity-80">Preferences</span>
          <button onClick={onClose} className="hover:bg-[#c42b1c] hover:text-white bg-white/5 p-[0.3em] rounded-sm"><X size={14} /></button>
        </div>
        <div className="p-[1.5em] space-y-[1.5em]">
          <div className="space-y-[0.5em]">
            <div className="flex justify-between items-center text-[1em] font-bold opacity-70">
              <span>Interface Font Size</span>
              <span>{currentFontSize}px</span>
            </div>
            <input
              type="range"
              min="10"
              max="18"
              step="1"
              value={currentFontSize}
              onChange={handleFontSizeChange}
              className="w-full h-[0.3em] bg-[#444] rounded-lg appearance-none cursor-pointer accent-[#0078d7]"
            />
            <div className="text-[0.85em] opacity-40">Adjust the text size of the interface.</div>
          </div>

          <div className="pt-[1em] border-t border-white/5 flex justify-end">
            <button onClick={onClose} className="bg-[#0078d7] hover:bg-[#005a9e] text-white px-[1em] py-[0.4em] rounded text-[1em] font-bold shadow-sm">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTool, setActiveTool] = useState("select");
  const [appData, setAppData] = useState<any>(null);
  const [powerStatus, setPowerStatus] = useState<any>(null);
  const [tempSize, setTempSize] = useState({ x: "", y: "" });

  // Modals & Menus
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [activeSidePanel, setActiveSidePanel] = useState<"facilities" | "logistics" | null>(null);
  const [activeFacilityId, setActiveFacilityId] = useState<string | null>(null); // NEW: Track selected facility
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showRecipes, setShowRecipes] = useState(false);

  // Port Selector Modal State
  const [portSelector, setPortSelector] = useState<{
    isOpen: boolean,
    instanceId: string | null,
    portId: string | null,
    facilityName: string | null
  }>({ isOpen: false, instanceId: null, portId: null, facilityName: null });

  const [dragState, setDragState] = useState<{ id: string | null, icon: string | null, x: number, y: number }>({ id: null, icon: null, x: 0, y: 0 });
  const mousePos = useRef({ x: 0, y: 0 });
  const appDataRef = useRef<any>(null);

  const clearDragState = () => {
    debugLog("App: clearDragState called");
    setDragState({ id: null, icon: null, x: 0, y: 0 });
  };

  // 1. Initial Data Load
  useEffect(() => {
    invoke("get_app_data").then((data: any) => {
      setAppData(data);
      appDataRef.current = data;
      if (data?.config) {
        setTempSize({
          x: String(data.config.world_size_tiles_x || 32),
          y: String(data.config.world_size_tiles_y || 20)
        });
      }
    });
  }, []);

  // 2. Event Listeners & Timers
  useEffect(() => {
    (window as any).clearDragState = clearDragState;
    appDataRef.current = appData; // Keep ref in sync

    const interval = setInterval(() => {
      invoke("get_power_status").then(setPowerStatus);
    }, 1000);

    const handleGlobalMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (dragState.id) {
        setDragState(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      const currentData = appDataRef.current;
      const config = currentData?.config;
      if (config && e.code === config.belt_shortcut && currentData.facilities) {
        const belt = currentData.facilities.find((f: any) => f.id === config.belt_id);
        if (belt) {
          debugLog("[Shortcut] Key detected:", e.code, "activating belt:", belt.id);
          setDragState({
            id: belt.id,
            icon: belt.icon,
            x: mousePos.current.x,
            y: mousePos.current.y
          });
          setActiveTool("logistics");
          debugLog("[Shortcut] Goal Print: Belt placement shortcut triggered successfully");
        }
      }
    };

    const handlePortSelectorOpen = (e: any) => {
      debugLog("[App] handlePortSelectorOpen event received:", e.detail);
      setPortSelector({
        isOpen: true,
        instanceId: e.detail.instanceId,
        portId: e.detail.portId,
        facilityName: e.detail.facilityName
      });
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("open-port-selector", handlePortSelectorOpen);

    const closeMenu = () => setActiveMenu(null);
    window.addEventListener("click", closeMenu);

    const handleMouseGrid = (e: any) => {
      const el = document.getElementById("footer-coord");
      if (el) el.innerText = `${e.detail.x}, ${e.detail.y}`;
    };
    (window as any).updateFooterCoord = (x: number, y: number) => {
      const el = document.getElementById("footer-coord");
      if (el) el.innerText = `${x}, ${y}`;
    };
    window.addEventListener('mouse-grid-update', handleMouseGrid);

    const handleFacilitySelected = (e: any) => {
      debugLog("App: Facility Selected", e.detail.id);
      setActiveFacilityId(e.detail.id);
    };
    window.addEventListener('facility-selected', handleFacilitySelected);

    return () => {
      clearInterval(interval);
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener('mouse-grid-update', handleMouseGrid);
      window.removeEventListener('facility-selected', handleFacilitySelected);
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("open-port-selector", handlePortSelectorOpen);
      delete (window as any).updateFooterCoord;
    };
  }, [dragState.id]); // Removed appData from dependencies
  // Dependency on dragState.id is important for the closure in handleGlobalMouseMove if we used state directly, 
  // but setState callback form is safe. 
  // However, handleGlobalMouseUp reads dragState.id. So, we need it in dependency or use a ref.
  // Ideally, use ref for current drag state to avoid re-binding listeners constantly, but checking ID in setState callback is tricky for "reading" it.
  // Simpler to just re-bind listeners when drag state ID changes (dragging starts/stops).

  const handleDragStart = (e: React.MouseEvent, facility: any) => {
    e.preventDefault();
    setDragState({
      id: facility.id,
      icon: facility.icon,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleConfigChange = (updates: Record<string, any>) => {
    if (!appData) return;
    const newConfig = { ...appData.config, ...updates };
    const newData = { ...appData, config: newConfig };
    setAppData(newData);
    invoke("update_config", { config: newConfig });
  };

  const handlePortItemSelect = (itemId: string) => {
    if (!portSelector.instanceId || !portSelector.portId) return;

    const pf = (window as any).placedFacilities?.find((f: any) => f.instanceId === portSelector.instanceId);
    if (pf) {
      const currentSettings = pf.port_settings || [];
      const otherSettings = currentSettings.filter((s: any) => s.port_id !== portSelector.portId);
      const newSettings = [...otherSettings, { port_id: portSelector.portId, item_id: itemId }];

      (window as any).updateFacility(portSelector.instanceId, { port_settings: newSettings });

      // Close modal
      setPortSelector(prev => ({ ...prev, isOpen: false }));
    }
  };

  const theme = appData?.config?.theme || {
    panel_bg: "#2d2d2d",
    workspace_bg: "#1e1e1e",
    border: "#1c1c1c",
    text: "#d3d3d3",
    accent: "#0078d7"
  };

  // Apply font size to root. Default 12px if not set.
  const uiFontSize = appData?.config?.font_size_px || 12;


  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden select-none font-sans relative"
      style={{
        backgroundColor: theme.workspace_bg,
        color: theme.text,
        fontSize: `${uiFontSize}px`
      }}
    >
      <header className="h-[2.4em] border-b flex items-center px-[1em] gap-[1.2em] font-normal relative z-50" style={{ backgroundColor: theme.panel_bg, borderColor: theme.border }}>
        <div className="flex items-center gap-[0.3em]">
          <Menu size={14} className="text-[#888]" style={{ width: '1.1em', height: '1.1em' }} />
          <span className="font-bold text-[0.85em] tracking-tighter opacity-70 ml-[0.3em]">EF</span>
        </div>

        {/* File Menu */}
        <div className="relative">
          <span
            className={cn("hover:bg-[#4b4b4b] px-[0.6em] py-[0.3em] rounded-sm cursor-default transition-colors text-[0.9em]", activeMenu === "File" && "bg-[#4b4b4b]")}
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === "File" ? null : "File"); }}
          >
            File
          </span>
          {activeMenu === "File" && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#2b2b2b] border border-[#1c1c1c] shadow-xl rounded-sm py-1 flex flex-col z-50 animate-in slide-in-from-top-1 duration-100">
              <button className="text-left px-4 py-1.5 hover:bg-[#0078d7] hover:text-white transition-colors flex justify-between items-center group text-[0.9em]">
                <span>New...</span> <span className="opacity-40 text-[0.8em] group-hover:text-white/80">Ctrl+N</span>
              </button>
              <button className="text-left px-4 py-1.5 hover:bg-[#0078d7] hover:text-white transition-colors flex justify-between items-center group text-[0.9em]">
                <span>Open...</span> <span className="opacity-40 text-[0.8em] group-hover:text-white/80">Ctrl+O</span>
              </button>
              <div className="h-px bg-white/10 my-1 mx-2" />
              <button
                className="text-left px-4 py-1.5 hover:bg-[#0078d7] hover:text-white transition-colors text-[0.9em]"
                onClick={() => { setIsPreferencesOpen(true); setActiveMenu(null); }}
              >
                Preferences...
              </button>
              <div className="h-px bg-white/10 my-1 mx-2" />
              <button className="text-left px-4 py-1.5 hover:bg-[#0078d7] hover:text-white transition-colors text-[0.9em]">Exit</button>
            </div>
          )}
        </div>

        {["Edit", "Layout", "Simulation", "View", "Window", "Help"].map(m => (
          <span key={m} className="hover:bg-[#4b4b4b] px-[0.6em] py-[0.3em] rounded-sm cursor-default text-[0.9em]">{m}</span>
        ))}
        <div className="flex-1" />
        <span className="opacity-50 text-[0.85em]">Endfield Architect v0.1.0</span>
      </header>

      {/* ... ToolBar ... */}
      <div className="h-[2.8em] border-b flex items-center px-[1.2em] gap-[1.5em]" style={{ backgroundColor: theme.panel_bg, borderColor: theme.border }}>
        <div className="flex items-center gap-[0.6em] border-r pr-[1em]" style={{ borderColor: theme.border }}>
          <div className="p-[0.2em] bg-[#4b4b4b] rounded shadow-inner">
            {activeTool === 'select' && <MousePointer2 style={{ width: '1.2em', height: '1.2em' }} />}
            {activeTool === 'move' && <Move style={{ width: '1.2em', height: '1.2em' }} />}
            {activeTool === 'facility' && <Box style={{ width: '1.2em', height: '1.2em' }} />}
            {activeTool === 'logistics' && <Link2 style={{ width: '1.2em', height: '1.2em' }} />}
            {activeTool === 'eraser' && <Eraser style={{ width: '1.2em', height: '1.2em' }} />}
          </div>
          <ChevronDown style={{ width: '1em', height: '1em' }} className="opacity-50" />
        </div>
        <div className="flex items-center gap-[1em] text-[0.85em]">
          <div className="flex items-center gap-[0.5em]">
            <span className="opacity-60">Grid:</span>
            <select className="bg-[#1e1e1e] border border-[#444] rounded px-[0.3em] text-white outline-none">
              <option>64px</option>
              <option>32px</option>
            </select>
          </div>
          <div className="flex items-center gap-[0.5em]">
            <span className="opacity-60">Snap:</span>
            <input type="checkbox" checked readOnly className="accent-[#0078d7]" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[3.2em] border-r flex flex-col items-center py-[0.6em] gap-[0.3em] group z-20 relative" style={{ backgroundColor: theme.panel_bg, borderColor: theme.border }}>
          <button
            onClick={() => {
              setActiveTool("facility");
              setActiveSidePanel(activeSidePanel === "facilities" ? null : "facilities");
            }}
            className={cn(
              "w-[2.2em] h-[2.2em] flex items-center justify-center rounded-sm transition-colors relative",
              activeSidePanel === "facilities" ? "bg-[#4b4b4b] text-white shadow-inner" : "text-[#b0b0b0] hover:bg-[#3d3d3d]"
            )}
            title="Facilities (Production & Power)"
          >
            <Box size={18} strokeWidth={1.5} style={{ width: '1.4em', height: '1.4em' }} />
            {activeSidePanel === "facilities" && (
              <div className="absolute bottom-[2px] right-[2px] w-0 h-0 border-l-[3px] border-l-transparent border-t-[3px] border-t-transparent border-r-[3px] border-r-white/50 border-b-[3px] border-b-white/50 rotate-45" />
            )}
          </button>

          <button
            onClick={() => {
              // We use "facility" tool for placement, but "logistics" activeTool for top bar icon if desired
              // Keeping "facility" ensures consistency with Viewport behavior
              setActiveTool("logistics");
              setActiveSidePanel(activeSidePanel === "logistics" ? null : "logistics");
            }}
            className={cn(
              "w-[2.2em] h-[2.2em] flex items-center justify-center rounded-sm transition-colors relative",
              activeSidePanel === "logistics" ? "bg-[#4b4b4b] text-white shadow-inner" : "text-[#b0b0b0] hover:bg-[#3d3d3d]"
            )}
            title="Logistics"
          >
            <Link2 size={18} strokeWidth={1.5} style={{ width: '1.4em', height: '1.4em' }} />
            {activeSidePanel === "logistics" && (
              <div className="absolute bottom-[2px] right-[2px] w-0 h-0 border-l-[3px] border-l-transparent border-t-[3px] border-t-transparent border-r-[3px] border-r-white/50 border-b-[3px] border-b-white/50 rotate-45" />
            )}
          </button>
        </aside>

        {/* Facilities/Logistics Flyout Panel */}
        {activeSidePanel && (
          <div
            className="absolute left-[3.2em] top-0 bottom-0 w-[18em] z-10 flex flex-col shadow-2xl animate-in slide-in-from-left-2 duration-200 border-r"
            style={{ backgroundColor: "#252525", borderColor: theme.border }}
          >
            <div className="h-[2.8em] flex items-center px-[1em] justify-between border-b" style={{ borderColor: theme.border, backgroundColor: theme.panel_bg }}>
              <span className="text-[0.8em] font-bold uppercase tracking-wider opacity-90">
                {activeSidePanel === "logistics" ? "Logistics" : "Facilities"}
              </span>
              <button
                onClick={() => setActiveSidePanel(null)}
                className="hover:bg-white/10 p-1 rounded-sm transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#1e1e1e]">
              {!appData?.facilities ? (
                <div className="p-4 text-center text-white/40 text-sm">Loading data...</div>
              ) : appData.facilities.length === 0 ? (
                <div className="p-4 text-center text-white/40 text-sm">No facilities found.</div>
              ) : (
                appData.facilities
                  .filter((f: any) => {
                    if (activeSidePanel === "logistics") {
                      return f.category === "logistics";
                    } else {
                      return f.category !== "logistics";
                    }
                  })
                  .map((f: any) => (
                    <div
                      key={f.id}
                      onMouseDown={(e) => handleDragStart(e, f)}
                      className="flex items-center gap-3 p-2 hover:bg-[#0078d7] hover:text-white rounded-sm cursor-grab active:cursor-grabbing group transition-all border border-transparent hover:border-white/10"
                      onClick={() => {
                        // Keep panel open but ensure tool is correct
                        setActiveTool(activeSidePanel === "logistics" ? "logistics" : "facility");
                      }}
                    >
                      <div className="w-8 h-8 rounded bg-[#2b2b2b] p-1 flex items-center justify-center border border-white/5 group-hover:border-white/20 group-hover:bg-white/10 shrink-0 pointer-events-none">
                        <img src={f.icon} alt={f.name} className="max-w-full max-h-full opacity-90 group-hover:opacity-100" />
                      </div>
                      <div className="flex flex-col min-w-0 pointer-events-none">
                        <span className="text-[0.85em] font-bold leading-tight decoration-clone truncate">{f.name}</span>
                        <span className="text-[0.7em] opacity-40 group-hover:opacity-80">{f.width}x{f.height}</span>
                      </div>
                    </div>
                  )))}
            </div>
          </div>
        )}

        <main className="flex-1 relative overflow-hidden flex flex-col" style={{ backgroundColor: "#191919" }}>
          <div className="h-[2.2em] flex items-center" style={{ backgroundColor: "#282828" }}>
            <div className="h-full px-[1em] flex items-center gap-[0.5em] bg-[#323232] border-r border-[#1c1c1c] text-[0.85em] min-w-[120px]">
              <span className="opacity-80">Untitled-1.json</span>
              <span className="text-[0.8em] opacity-40">@ 100% (RGB/8)</span>
              <div className="w-[1.2em] h-[1.2em] flex items-center justify-center hover:bg-[#c42b1c] rounded-sm ml-auto cursor-pointer">×</div>
            </div>
            <div className="flex-1 h-full bg-[#1e1e1e]" />
          </div>
          <div className="flex-1 relative bg-[#1e1e1e]">
            <Viewport appData={appData} draggedFacilityId={dragState.id} onDropFinished={clearDragState} />
          </div>
        </main>

        <aside className="w-[22em] border-l flex flex-col overflow-hidden" style={{ backgroundColor: theme.panel_bg, borderColor: theme.border }}>
          <div className="flex-1 overflow-y-auto">

            <PanelSection title="Canvas Size"
              bgColor="#2d2d2d88"
              headerActions={
                <button onClick={() => setIsPresetModalOpen(true)} className="p-1 hover:bg-white/10 rounded-sm" title="New Document / Presets"><PlusCircle size={14} style={{ width: '1.1em', height: '1.1em' }} /></button>
              }
            >
              <div className="p-[1em] space-y-[1em]">
                <div className="flex flex-col gap-[0.5em]">
                  <span className="opacity-50 text-[0.75em] uppercase font-bold">Preset Documents</span>
                  <select
                    className="bg-[#1e1e1e] border border-[#444] px-[0.5em] h-[2.2em] rounded-sm text-[0.85em] text-white outline-none w-full"
                    onChange={(e) => {
                      const preset = appData?.config?.presets?.find((p: any) => p.id === e.target.value);
                      if (preset) setTempSize({ x: String(preset.width), y: String(preset.height) });
                    }}
                  >
                    <option value="custom">Custom Size</option>
                    {appData?.config?.presets?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.width}x{p.height})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-[1em]">
                  <div className="flex flex-col gap-[0.5em]">
                    <span className="opacity-50 text-[0.75em] uppercase font-bold">Width</span>
                    <div className="flex items-center gap-1 bg-[#1e1e1e] border border-[#444] px-[0.5em] h-[2.2em] rounded-sm focus-within:border-[#0078d7]">
                      <input type="text" value={tempSize.x} onChange={(e) => setTempSize({ ...tempSize, x: e.target.value })} className="bg-transparent w-full outline-none text-white text-[0.9em] select-text" />
                      <span className="text-[0.7em] opacity-30 italic">tile</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[0.5em]">
                    <span className="opacity-50 text-[0.75em] uppercase font-bold">Height</span>
                    <div className="flex items-center gap-1 bg-[#1e1e1e] border border-[#444] px-[0.5em] h-[2.2em] rounded-sm focus-within:border-[#0078d7]">
                      <input type="text" value={tempSize.y} onChange={(e) => setTempSize({ ...tempSize, y: e.target.value })} className="bg-transparent w-full outline-none text-white text-[0.9em] select-text" />
                      <span className="text-[0.7em] opacity-30 italic">tile</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleConfigChange({ world_size_tiles_x: parseInt(tempSize.x) || 32, world_size_tiles_y: parseInt(tempSize.y) || 20 })}
                  className="w-full h-[2.5em] bg-[#0078d7] hover:bg-[#005a9e] text-white font-bold text-[0.85em] rounded flex items-center justify-center gap-[0.5em] shadow-sm transition-all"
                >
                  <Check style={{ width: '1.2em', height: '1.2em' }} /> APPLY CHANGES
                </button>
              </div>
            </PanelSection>

            <PanelSection title="Catalog" defaultOpen={true}>
              <div className="h-48 overflow-y-auto p-1 grid grid-cols-3 gap-1 bg-[#222]">
                {appData?.facilities?.slice(0, 15).map((f: any) => (
                  <div key={f.id} className="aspect-square bg-[#323232] border border-[#444] p-1 flex items-center justify-center hover:border-[#0078d7] cursor-pointer relative group">
                    <img src={f.icon} alt={f.name} className="max-w-full max-h-full" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[0.7em] text-center p-1 leading-tight">{f.name}</div>
                  </div>
                ))}
              </div>
            </PanelSection>

            <PanelSection title="Power Console" bgColor="#2d2d2d">
              <div className="p-[1em] space-y-[0.8em]">
                <div className="flex flex-col gap-[0.4em]">
                  <div className="flex justify-between text-[0.75em] opacity-70"><span>LOAD BALANCE</span><span className={cn(powerStatus?.power_balance >= 0 ? "text-green-500" : "text-red-500 font-bold")}>{powerStatus?.power_balance?.toFixed(1) || "0.0"} MW</span></div>
                  <div className="h-[0.5em] bg-black rounded-full overflow-hidden">
                    <div className="h-full bg-[#0078d7]" style={{ width: `${Math.min(100, (powerStatus?.total_consumption / (powerStatus?.total_generation || 1)) * 100)}%` }} />
                  </div>
                </div>
                <div className="space-y-[0.4em] opacity-60 text-[0.75em]">
                  <div className="flex justify-between"><div className="flex items-center gap-1"><Zap style={{ width: '1em', height: '1em' }} /> Generation:</div><span>{powerStatus?.total_generation?.toFixed(1) || "0.0"}</span></div>
                  <div className="flex justify-between"><div className="flex items-center gap-1"><Cpu style={{ width: '1em', height: '1em' }} /> Consumption:</div><span>{powerStatus?.total_consumption?.toFixed(1) || "0.0"}</span></div>
                </div>
              </div>
            </PanelSection>

          </div>
        </aside>
      </div>

      <footer className="h-[2em] border-t flex items-center px-[1em] gap-[1.5em] text-[0.85em] opacity-60 font-mono" style={{ backgroundColor: theme.panel_bg, borderColor: theme.border }}>
        <div className="flex items-center gap-[0.5em]"><span className="font-bold">100%</span></div>
        <div className="h-[1em] w-px bg-white/10" />
        <div className="flex items-center gap-[1.2em]">
          <div className="flex items-center gap-1.5 font-bold text-sky-400">
            <span className="opacity-40 text-[0.8em]">GRID:</span>
            <span id="footer-coord">0, 0</span>
          </div>
          <div className="flex items-center gap-1 opacity-40">
            <span>Scale: 1:1</span>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-[0.5em]"><Info style={{ width: '1em', height: '1em' }} /><span>System Ready</span></div>
      </footer>
      <PresetModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        appData={appData}
        onConfigChange={handleConfigChange}
        onSelectPreset={(w, h) => setTempSize({ x: w, y: h })}
      />

      {/* Floating Facility Detail Modal */}
      {activeFacilityId && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#252525] border border-[#444] shadow-2xl rounded p-0 w-[40em] z-50 animate-in fade-in zoom-in-95 duration-100 font-sans text-sm">
          {(() => {
            const instanceId = activeFacilityId;
            const pf = (window as any).placedFacilities?.find((f: any) => f.instanceId === instanceId);
            const meta = appData?.facilities?.find((f: any) => f.id === pf?.facilityId);

            if (!instanceId || !pf || !meta) return null;

            // Find Recipes
            const recipes = appData?.recipes?.filter((r: any) => r.facility_id === meta.id) || [];
            const getItem = (id: string) => appData?.items?.find((i: any) => i.id === id);

            return (
              <div className="flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-2 bg-[#2d2d2d] border-b border-[#444] select-none shrink-0" onMouseDown={() => { /* TODO: Drag Logic for Window */ }}>
                  <span className="font-bold text-[0.9em] uppercase opacity-80 flex items-center gap-2"><Maximize2 size={12} /> Facility Detail</span>
                  <button onClick={() => setActiveFacilityId(null)} className="hover:bg-white/10 p-1 rounded-sm transition-colors text-white/60 hover:text-white"><X size={14} /></button>
                </div>

                <div className="p-[1.5em] space-y-[1.5em] overflow-y-auto custom-scrollbar">
                  <div className="flex gap-[1.5em]">
                    {/* Left Column: Icon & Basic Info */}
                    <div className="w-[12em] flex flex-col gap-[1em] shrink-0">
                      <div className="aspect-square bg-[#222] border border-[#444] rounded flex items-center justify-center p-2 shadow-inner">
                        <img src={meta.icon} className="max-w-full max-h-full drop-shadow-lg" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="text-[1.1em] font-bold leading-tight text-white/90">{meta.name}</div>
                        <div className="text-[0.75em] opacity-40 font-mono select-text break-all">{meta.id}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-[0.5em] py-[0.15em] bg-[#0078d7] text-white text-[0.7em] font-bold rounded uppercase shadow-sm">{meta.category || "General"}</span>
                          <span className="px-[0.5em] py-[0.15em] bg-[#333] border border-[#444] text-white/70 text-[0.7em] font-bold rounded uppercase">Tier {meta.tier || 1}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Stats & Recipes */}
                    <div className="flex-1 space-y-[1.5em]">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-px bg-white/5 border border-white/10 rounded overflow-hidden">
                        <div className="bg-[#2a2a2a]/50 p-[0.8em] flex flex-col gap-[0.2em]">
                          <span className="text-[0.65em] opacity-40 uppercase font-bold tracking-wider">Dimensions</span>
                          <span className="text-[1em] font-mono text-white/80">{meta.width} x {meta.height}</span>
                        </div>
                        <div className="bg-[#2a2a2a]/50 p-[0.8em] flex flex-col gap-[0.2em]">
                          <span className="text-[0.65em] opacity-40 uppercase font-bold tracking-wider">Power</span>
                          <span className={cn("text-[1em] font-mono font-bold", (meta.power || 0) > 0 ? "text-red-400" : (meta.power_generation > 0 ? "text-emerald-400" : "opacity-50"))}>
                            {meta.power_generation > 0 ? `+${meta.power_generation} MW` : `-${meta.power || 0} MW`}
                          </span>
                        </div>
                        <div className="bg-[#2a2a2a]/50 p-[0.8em] flex flex-col gap-[0.2em]">
                          <span className="text-[0.65em] opacity-40 uppercase font-bold tracking-wider">Rotation</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[1em] font-mono text-white/80">{pf.rotation}°</span>
                            <div className="w-4 h-4 border border-white/20 rounded-full flex items-center justify-center transform" style={{ transform: `rotate(${pf.rotation}deg)` }}>
                              <div className="w-0.5 h-2 bg-white/50 -mt-1" />
                            </div>
                          </div>
                        </div>
                        <div className="bg-[#2a2a2a]/50 p-[0.8em] flex flex-col gap-[0.2em]">
                          <span className="text-[0.65em] opacity-40 uppercase font-bold tracking-wider">IO Slots</span>
                          <div className="flex gap-2 text-[0.9em] font-mono">
                            <span title="Input Slots" className="text-sky-400 font-bold">IN: {meta.input_slots || 0}</span>
                            <span className="opacity-10">|</span>
                            <span title="Output Slots" className="text-orange-400 font-bold">OUT: {meta.output_slots || 0}</span>
                          </div>
                        </div>
                      </div>

                      {/* Features */}
                      {(meta.is_filter || meta.throughput_limit || meta.ports) && (
                        <div className="flex flex-wrap gap-[0.5em]">
                          {meta.is_filter && <span className="px-2 py-1 bg-purple-500/10 text-purple-300 text-[0.75em] border border-purple-500/20 rounded flex items-center gap-1"><Filter size={12} /> Filter Capable</span>}
                          {meta.throughput_limit && <span className="px-2 py-1 bg-yellow-500/10 text-yellow-300 text-[0.75em] border border-yellow-500/20 rounded flex items-center gap-1"><Activity size={12} /> Max Flow: {meta.throughput_limit}/s</span>}
                          {meta.ports && <span className="px-2 py-1 bg-white/5 text-white/40 text-[0.75em] border border-white/10 rounded flex items-center gap-1"><CircleDot size={12} /> {meta.ports.length} Ports</span>}
                        </div>
                      )}

                      {/* I/O STORAGE DISPLAY */}
                      {(meta.input_slots > 0 || meta.output_slots > 0) && (
                        <div className="space-y-[0.8em]">
                          <div className="text-[0.75em] opacity-50 uppercase font-bold tracking-wider border-b border-white/10 pb-1">Storage & I/O Buffers</div>
                          <div className="flex items-center justify-between gap-[2em] bg-black/20 p-4 rounded-lg border border-white/5">
                            {/* Input Slots */}
                            <div className="flex flex-col gap-3 flex-1">
                              <span className="text-[0.65em] font-bold opacity-30 uppercase text-center">Inputs</span>
                              <div className="flex gap-2 justify-center">
                                {[...Array(meta.input_slots || 0)].map((_, i) => {
                                  // Simplified: Show unique items in input_buffer as slots
                                  const uniqueItems = Array.from(new Set(pf.input_buffer?.map((s: any) => s.item_id as string) || []));
                                  const itemId = uniqueItems[i];
                                  const item = (typeof itemId === 'string') ? getItem(itemId) : null;
                                  const count = pf.input_buffer?.filter((s: any) => s.item_id === itemId).reduce((acc: number, s: any) => acc + (s.quantity || 1), 0) || 0;
                                  const max = appData?.config?.slot_capacity || 50;

                                  return (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                      <div className="w-[4em] h-[4em] bg-[#1a1a1a] border border-white/10 rounded flex items-center justify-center p-2 relative group/slot">
                                        {item ? (
                                          <>
                                            <img src={item.icon} className="max-w-full max-h-full drop-shadow-md" />
                                            <div className="absolute -top-1 -right-1 bg-sky-600 text-[0.65em] font-bold px-1 rounded shadow-lg">{count}</div>
                                          </>
                                        ) : (
                                          <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
                                        )}
                                      </div>
                                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-sky-500/50" style={{ width: `${(count / max) * 100}%` }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Arrow */}
                            <div className="opacity-10 shrink-0">
                              <ChevronRight size={24} />
                            </div>

                            {/* Output Slots */}
                            <div className="flex flex-col gap-3 flex-1">
                              <span className="text-[0.65em] font-bold opacity-30 uppercase text-center">Output</span>
                              <div className="flex justify-center">
                                {Array.from({ length: meta.output_slots || 0 }).map((_, i) => {
                                  const uniqueItems = Array.from(new Set(pf.output_buffer?.map((s: any) => s.item_id as string) || []));
                                  const itemId = uniqueItems[i];
                                  const item = (typeof itemId === 'string') ? getItem(itemId) : null;
                                  const count = pf.output_buffer?.filter((s: any) => s.item_id === itemId).reduce((acc: number, s: any) => acc + (s.quantity || 1), 0) || 0;
                                  const max = appData?.config?.slot_capacity || 50;

                                  return (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                      <div className="w-[4em] h-[4em] bg-[#1a1a1a] border border-white/10 rounded flex items-center justify-center p-2 relative group/slot">
                                        {item ? (
                                          <>
                                            <img src={item.icon} className="max-w-full max-h-full drop-shadow-md" />
                                            <div className="absolute -top-1 -right-1 bg-orange-600 text-[0.65em] font-bold px-1 rounded shadow-lg">{count}</div>
                                          </>
                                        ) : (
                                          <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
                                        )}
                                      </div>
                                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-orange-500/50" style={{ width: `${(count / max) * 100}%` }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* RECIPES SECTION (Collapsible Bar) */}
                      {recipes.length > 0 ? (
                        <div className="border border-white/5 rounded overflow-hidden">
                          <button
                            onClick={() => setShowRecipes(!showRecipes)}
                            className="w-full h-[3em] bg-[#2d2d2d] flex items-center px-4 justify-between hover:bg-[#333] transition-colors border-b border-black/20"
                          >
                            <span className="text-[0.8em] font-bold uppercase tracking-widest text-[#0078d7] flex items-center gap-3">
                              <Cpu size={16} /> Recipe Database
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-[0.7em] bg-white/5 px-2 py-0.5 rounded opacity-50 font-mono">{recipes.length} PLUGINS</span>
                              {showRecipes ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                          </button>

                          {showRecipes && (
                            <div className="p-3 space-y-3 bg-black/10 animate-in slide-in-from-top-2 duration-200 overflow-y-auto max-h-[25em] custom-scrollbar">
                              <div className="grid gap-[0.5em]">
                                {recipes.map((r: any) => (
                                  <div key={r.id} className="bg-[#1e1e1e] border border-[#333] p-[1em] rounded-md flex items-center justify-between gap-[1em] hover:bg-[#252525] hover:border-white/10 transition-colors group">
                                    <div className="flex items-center gap-[0.8em]">
                                      {r.inputs.map((input: any, idx: number) => {
                                        const item = getItem(input.item_id);
                                        return (
                                          <div key={idx} className="relative group/item" title={item?.name || input.item_id}>
                                            <div className="w-[3.2em] h-[3.2em] bg-[#2a2a2a] border border-[#444] rounded flex items-center justify-center p-1 shadow-sm group-hover/item:border-[#0078d7]">
                                              {item?.icon && <img src={item.icon} className="max-w-full max-h-full drop-shadow-md" />}
                                            </div>
                                            <div className="absolute -bottom-1 -right-1 bg-[#111] text-white text-[0.65em] font-bold font-mono px-1 rounded border border-[#333] shadow-md z-10">{input.amount}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex flex-col items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity px-2 gap-1">
                                      <div className="w-[2em] h-px bg-white/20 relative">
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-1.5 h-1.5 border-t border-r border-white/20 rotate-45" />
                                      </div>
                                      <span className="text-[0.6em] font-mono font-bold opacity-60">{r.time}s</span>
                                    </div>
                                    <div className="flex items-center gap-[0.8em]">
                                      {r.outputs.map((output: any, idx: number) => {
                                        const item = getItem(output.item_id);
                                        return (
                                          <div key={idx} className="relative group/item" title={item?.name || output.item_id}>
                                            <div className="w-[3.2em] h-[3.2em] bg-[#2a2a2a] border border-[#444] rounded flex items-center justify-center p-1 shadow-sm group-hover/item:border-[#0078d7]">
                                              {item?.icon && <img src={item.icon} className="max-w-full max-h-full drop-shadow-md" />}
                                            </div>
                                            <div className="absolute -bottom-1 -right-1 bg-[#0078d7] text-white text-[0.65em] font-bold font-mono px-1 rounded shadow-md z-10">{output.amount}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        appData?.config?.universal_provider_facility_ids?.includes(meta.id) && (
                          <div className="space-y-[0.8em] animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="text-[0.75em] text-emerald-400 uppercase font-bold tracking-wider border-b border-emerald-500/20 pb-1 flex items-center gap-2">
                              <Activity size={12} /> Universal Item Emitter
                            </div>
                            <div className="bg-emerald-500/5 border border-emerald-500/10 p-[1.2em] rounded-md text-[0.85em] leading-relaxed text-emerald-200/70 italic">
                              This facility acts as a primary entry point for all raw materials and logistics throughput. It can emit any item selected in the logistics configuration without requiring a local recipe.
                            </div>
                            <div className="grid grid-cols-5 gap-2 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                              {appData?.items?.filter((i: any) => i.is_raw).slice(0, 5).map((i: any) => (
                                <div key={i.id} className="aspect-square bg-[#1a1a1a] border border-[#333] rounded p-1.5 flex items-center justify-center" title={i.name}>
                                  <img src={i.icon} className="max-w-full max-h-full" />
                                </div>
                              ))}
                              <div className="aspect-square bg-white/5 border border-white/5 rounded flex items-center justify-center text-[1.2em] font-bold text-white/20">...</div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-[1em] border-t border-white/5 flex justify-between text-[0.75em] opacity-30 font-mono">
                    <span>Pos: {Math.floor(pf.x / (appData?.config?.grid_size || 64))}, {Math.floor(pf.y / (appData?.config?.grid_size || 64))}</span>
                    <span>UUID: {pf.instanceId}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Preferences Modal */}
      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        config={appData?.config}
        onConfigChange={handleConfigChange}
      />

      {/* Custom Drag Ghost */}
      {dragState.id && (
        <div
          className="fixed pointer-events-none z-[100] opacity-80"
          style={{
            left: dragState.x,
            top: dragState.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="bg-[#0078d7] p-2 rounded shadow-xl flex items-center gap-2 text-white border border-white/20">
            {dragState.icon && <img src={dragState.icon} className="w-6 h-6 bg-black/20 rounded-sm" />}
            <span className="font-bold text-sm">Placing Facility</span>
          </div>
        </div>
      )}
      {/* PORT SELECTOR MODAL */}
      <PortSelectorModal
        isOpen={portSelector.isOpen}
        onClose={() => setPortSelector(prev => ({ ...prev, isOpen: false }))}
        onSelect={handlePortItemSelect}
        appData={appData}
        facilityName={portSelector.facilityName}
        portId={portSelector.portId}
      />
    </div>
  );
}

function PortSelectorModal({ isOpen, onClose, onSelect, appData, facilityName, portId }: any) {
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (isOpen) debugLog("[App] PortSelectorModal rendered. Items:", appData?.items?.length);
  }, [isOpen, appData]);

  if (!isOpen) return null;

  const filteredItems = appData?.items?.filter((i: any) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.id.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-[2em]">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-[50em] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-[1.5em] border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-[3em] h-[3em] bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
              <Activity size={24} />
            </div>
            <div>
              <h2 className="text-[1.2em] font-bold text-white uppercase tracking-wider">Configure Logistics Output</h2>
              <p className="text-[0.8em] text-white/40">{facilityName} • Port: {portId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-[1.5em] space-y-[1.5em] overflow-hidden flex flex-col flex-1">
          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-440 transition-colors" size={18} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by name or ID..."
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
            />
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {filteredItems.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  title={item.name}
                  className="aspect-square bg-[#222] border border-white/5 rounded-lg flex flex-col items-center justify-center p-2 hover:bg-[#2a2a2a] hover:border-emerald-500/40 hover:scale-105 transition-all group relative"
                >
                  {item.icon ? (
                    <img src={item.icon} className="max-w-[70%] max-h-[70%] drop-shadow-lg group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  ) : (
                    <div className="text-white/20 text-xs">?</div>
                  )}
                  <div className="absolute inset-0 border-2 border-emerald-500/0 group-hover:border-emerald-500/20 rounded-lg pointer-events-none" />
                </button>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="h-[20em] flex flex-col items-center justify-center text-white/20 space-y-4">
                <Search size={48} className="opacity-20" />
                <p className="font-bold uppercase tracking-widest text-[0.9em]">No items found</p>
                {/* Debug hint */}
                <p className="text-[0.7em] text-white/20">Checked {appData?.items?.length || 0} items.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-[1em] bg-black/20 border-t border-white/5 text-center">
          <p className="text-[0.7em] text-white/20 uppercase tracking-[0.2em]">Select an item to assign to this output port</p>
        </div>
      </div>
    </div>
  );
}
