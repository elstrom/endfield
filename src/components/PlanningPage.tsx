import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Loader2, Zap, Plus } from "lucide-react";

interface TargetItem {
    itemId: string;
    itemName: string;
    rate: number; // items per minute
}

interface PlanningPageProps {
    onGenerateComplete: (layouts: any[]) => void;
}

export function PlanningPage({ onGenerateComplete }: PlanningPageProps) {
    const [availableItems, setAvailableItems] = useState<any[]>([]);
    const [targetItems, setTargetItems] = useState<TargetItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string>("");
    const [itemRate, setItemRate] = useState<number>(10);

    const [plateWidth, setPlateWidth] = useState<number>(30);
    const [plateHeight, setPlateHeight] = useState<number>(40);

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data: any = await invoke("get_app_data");
                console.log("DEBUG: App Data Loaded", data);
                if (data && data.items) {
                    const sorted = [...data.items].sort((a: any, b: any) => a.name.localeCompare(b.name));
                    setAvailableItems(sorted);
                }
            } catch (err) {
                console.error("Failed to load items:", err);
            }
        };
        loadData();
    }, []);

    const addTargetItem = () => {
        if (!selectedItemId) {
            console.warn("DEBUG: No item selected");
            return;
        }

        const item = availableItems.find((i) => i.id === selectedItemId);
        if (!item) {
            console.error("DEBUG: Item not found in availableItems", selectedItemId);
            return;
        }

        setTargetItems([
            ...targetItems,
            {
                itemId: selectedItemId,
                itemName: item.name,
                rate: itemRate,
            },
        ]);
        setSelectedItemId("");
        setItemRate(10);
    };

    const removeTargetItem = (index: number) => {
        setTargetItems(targetItems.filter((_, i) => i !== index));
    };

    const handleGenerate = async () => {
        if (targetItems.length === 0) {
            alert("Please add at least one target item to start production planning.");
            return;
        }

        setIsGenerating(true);
        setProgress(0);

        const progressInterval = setInterval(() => {
            setProgress((prev) => Math.min(prev + 5, 90));
        }, 300);

        try {
            const request = {
                target_items: targetItems.map((t) => [t.itemId, t.rate]),
                plate_width: plateWidth,
                plate_height: plateHeight,
                num_candidates: 100, // More candidates for better optimization
            };

            const layouts = await invoke("generate_optimal_layouts", { request });

            clearInterval(progressInterval);
            setProgress(100);

            setTimeout(() => {
                onGenerateComplete(layouts as any[]);
            }, 800);
        } catch (error) {
            console.error("Generation failed:", error);
            alert(`Failed to generate layouts: ${error}`);
            clearInterval(progressInterval);
            setIsGenerating(false);
            setProgress(0);
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-center p-8 text-slate-900">
            <div className="max-w-4xl w-full bg-white/90 backdrop-blur-3xl rounded-[3rem] border border-slate-200 p-12 shadow-[0_20px_50px_rgba(0,0,0,0.1)] relative overflow-hidden group">
                {/* Decorative Background Gradient */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand/5 rounded-full blur-[100px] group-hover:bg-brand/10 transition-all duration-1000" />

                {/* Header */}
                <div className="flex items-center justify-between mb-12 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center border border-brand/20">
                            <Zap className="text-brand" size={28} fill="currentColor" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic leading-none">
                                Neural <span className="text-brand">Planner</span>
                            </h1>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.4em] mt-2">Factory Optimization Matrix</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-12 relative z-10">
                    {/* Left Side: Goal Setup */}
                    <div className="md:col-span-3">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                            <div className="w-1 h-3 bg-brand rounded-full" />
                            Production Vector
                        </h2>

                        <div className="flex gap-4 mb-10">
                            <div className="flex-1">
                                <select
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all appearance-none cursor-pointer hover:bg-white"
                                >
                                    <option value="">Load item specification...</option>
                                    {availableItems.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-32 relative">
                                <input
                                    type="number"
                                    value={itemRate}
                                    onChange={(e) => setItemRate(Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-brand font-black font-mono focus:outline-none focus:border-brand transition-all text-center text-lg"
                                />
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white border border-slate-100 px-3 py-0.5 rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Target Rate (Suggestion)</span>
                            </div>

                            <button
                                onClick={addTargetItem}
                                className="w-16 h-16 bg-brand rounded-2xl text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,100,0,0.2)]"
                            >
                                <Plus size={32} strokeWidth={3} />
                            </button>
                        </div>

                        {/* Items List */}
                        <div className="space-y-3 min-h-[220px] max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {targetItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-3xl p-10 bg-slate-50/50">
                                    <div className="bg-white p-4 rounded-full mb-3 shadow-sm">
                                        <Plus size={20} className="text-slate-400" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest">No target items defined</p>
                                </div>
                            ) : (
                                targetItems.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between bg-white border border-slate-100 rounded-3xl p-5 hover:border-brand/30 hover:shadow-lg hover:shadow-slate-100 transition-all group/item"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 text-brand">
                                                <Zap size={20} fill="currentColor" />
                                            </div>
                                            <div>
                                                <div className="text-slate-900 font-black text-lg tracking-tight">{item.itemName}</div>
                                                <div className="text-brand text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                                                    {item.rate} units / min
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeTargetItem(index)}
                                            className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover/item:opacity-100"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Side: Constraints */}
                    <div className="md:col-span-2 border-l border-slate-100 pl-8">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                            <div className="w-1 h-3 bg-slate-200 rounded-full" />
                            Environmental Matrix
                        </h2>

                        <div className="space-y-6">
                            <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6 px-1">Plate Dimensions (Cells)</label>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <input
                                            type="number"
                                            value={plateWidth}
                                            onChange={(e) => setPlateWidth(Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-black font-mono focus:outline-none focus:border-brand transition-all"
                                        />
                                        <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest text-center block">Width</span>
                                    </div>
                                    <div className="space-y-3">
                                        <input
                                            type="number"
                                            value={plateHeight}
                                            onChange={(e) => setPlateHeight(Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-black font-mono focus:outline-none focus:border-brand transition-all"
                                        />
                                        <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest text-center block">Height</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900/5 border border-slate-100 rounded-[2rem] p-8">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Power Intelligence</label>
                                    <div className="px-3 py-1 bg-brand text-white rounded-full text-[8px] font-black uppercase tracking-widest">AI HUB</div>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
                                    Protocol Automation-Core (PAC) will be deployed as the neural hub for power & logistics synchronization.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-12 pt-10 border-t border-slate-100">
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || targetItems.length === 0}
                        className={`group w-full py-7 rounded-[2rem] font-black text-xl uppercase tracking-tighter transition-all flex items-center justify-center gap-6 ${isGenerating
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-900 text-white hover:bg-black shadow-[0_20px_40px_rgba(0,0,0,0.15)] active:scale-[0.98]"
                            }`}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin text-brand" size={28} />
                                Synthesizing Layout Matrix... {progress}%
                            </>
                        ) : (
                            <>
                                <Zap className="text-brand group-hover:scale-125 transition-transform" size={28} fill="currentColor" />
                                Initiate Neural Solver
                            </>
                        )}
                    </button>

                    {isGenerating && (
                        <div className="mt-8 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="h-full bg-brand transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
